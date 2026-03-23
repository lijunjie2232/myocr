// agent.ts
// Node >= 20 required for LangChain JS packages per docs
import { initChatModel } from "langchain/chat_models/universal";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Minimal helper types
type MemoryType = "none" | "trim" | "summary";
type OutputFormat = "txt" | "json" | "jsonp" | "xml" | "yaml";

interface AgentOptions {
  modelSpec: string; // "provider:modelName" or model identifier
  temperature?: number;
  maxTokens?: number; // use only if > 0
  systemPrompt?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  memory?: {
    type: MemoryType;
    // For trim: keep = number of memory items to retain.
    // For summary: target = max number of memory items after summarization, keep param unused.
    keep?: number;
    target?: number;
  };
  outputFormat?: OutputFormat;
  jsonpCallbackName?: string; // used only when outputFormat === "jsonp"
}

interface MemoryItem {
  text: string;
  meta?: Record<string, any>;
}

export class LangChainAgent {
  private model: any; // initChatModel return type
  private splitter: RecursiveCharacterTextSplitter;
  private memory: MemoryItem[] = [];
  private opts: Required<AgentOptions>;

  private constructor(opts: Required<AgentOptions>, model: any) {
    this.opts = opts;
    this.model = model;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: opts.chunkSize,
      chunkOverlap: opts.chunkOverlap,
    });
  }

  // Factory to create and initialize the agent (async because initChatModel is async)
  static async create(opts: AgentOptions) {
    const defaults: Required<AgentOptions> = {
      modelSpec: opts.modelSpec,
      temperature: opts.temperature ?? 0.0,
      maxTokens: opts.maxTokens ?? 0,
      systemPrompt:
        opts.systemPrompt ??
        "You are a helpful assistant. Use the provided context to answer the user's question.",
      chunkSize: opts.chunkSize ?? 1000,
      chunkOverlap: opts.chunkOverlap ?? 200,
      memory: opts.memory ?? { type: "none", keep: 10, target: 10 },
      outputFormat: opts.outputFormat ?? "txt",
      jsonpCallbackName: opts.jsonpCallbackName ?? "callback",
    };

    // Build init options for initChatModel
    const initOpts: Record<string, any> = { temperature: defaults.temperature };
    if (defaults.maxTokens > 0) {
      initOpts.maxTokens = defaults.maxTokens;
    }

    // initChatModel returns provider-agnostic chat model instance
    const model = await initChatModel(defaults.modelSpec, initOpts);

    return new LangChainAgent(defaults, model);
  }

  // Simple word overlap relevance ranking (no embeddings required)
  private scoreRelevance(query: string, chunk: string) {
    const qTokens = new Set(
      query
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
    );
    const cTokens = chunk
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean);
    let score = 0;
    for (const t of cTokens) {
      if (qTokens.has(t)) score++;
    }
    return score;
  }

  // Manage memory according to config
  private async manageMemoryAdd(item: MemoryItem) {
    const memCfg = this.opts.memory;
    if (memCfg.type === "none") return; // no-op

    // append new item
    this.memory.push(item);

    if (memCfg.type === "trim") {
      const keep = memCfg.keep ?? 10;
      // keep last `keep` items
      if (this.memory.length > keep) {
        this.memory = this.memory.slice(-keep);
      }
      return;
    }

    if (memCfg.type === "summary") {
      const target = memCfg.target ?? 10;
      // If memory is already within target, nothing to do
      if (this.memory.length <= target) return;

      // Summarize oldest items until memory length <= target.
      // Use the same model (this.model) to summarize.
      // We'll summarize batches of items into a single summary item.
      const toSummarizeCount = this.memory.length - target + 1; // number to compress
      const toSummarize = this.memory.slice(0, toSummarizeCount);
      const combinedText = toSummarize.map((m, i) => `Chunk ${i + 1}:\n${m.text}`).join("\n\n");

      const summarizationPrompt = [
        ["system", `You are a concise summarizer. Produce a short summary that preserves core facts.`],
        ["user", `Summarize the following content into a single concise memory entry (1-3 sentences):\n\n${combinedText}`],
      ];

      // Invoke the same model to summarize
      const sumRes = await this.model.invoke(summarizationPrompt);
      const summaryText =
        typeof sumRes === "string"
          ? sumRes
          : sumRes?.content ?? JSON.stringify(sumRes);

      // Replace the summarized items with a single summary memory item
      const remainder = this.memory.slice(toSummarizeCount);
      this.memory = [{ text: summaryText, meta: { summarized: true } }, ...remainder];
      // If still too long, trim oldest further
      if (this.memory.length > target) {
        this.memory = this.memory.slice(-target);
      }
    }
  }

  // Convert structured object to requested format
  private toOutput(obj: any): string {
    const fmt = this.opts.outputFormat;
    if (fmt === "txt") return obj.answer ?? obj; // raw answer text if present

    const json = JSON.stringify(obj, null, 2);

    if (fmt === "json") return json;

    if (fmt === "jsonp") {
      const cb = this.opts.jsonpCallbackName || "callback";
      return `${cb}(${json});`;
    }

    if (fmt === "xml") {
      // naive conversion for simple objects (strings, arrays, objects)
      const toXml = (key: string, value: any): string => {
        if (value == null) return `<${key}/>`;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          const esc = String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          return `<${key}>${esc}</${key}>`;
        }
        if (Array.isArray(value)) {
          return value.map((v) => `<${key}>${toXml("item", v)}</${key}>`).join("\n");
        }
        // object
        const inner = Object.entries(value)
          .map(([k, v]) => toXml(k, v))
          .join("\n");
        return `<${key}>\n${inner}\n</${key}>`;
      };
      return toXml("response", obj);
    }

    if (fmt === "yaml") {
      // simple JSON -> YAML converter for basic types
      const toYaml = (value: any, indent = 0): string => {
        const pad = "  ".repeat(indent);
        if (value == null) return "null\n";
        if (typeof value === "string") return `${pad}"${value.replace(/"/g, '\\"')}"\n`;
        if (typeof value === "number" || typeof value === "boolean") return `${pad}${value}\n`;
        if (Array.isArray(value)) {
          return value
            .map((v) => `${pad}- ${typeof v === "object" ? "\n" + toYaml(v, indent + 1) : v}`)
            .join("\n") + "\n";
        }
        // object
        return Object.entries(value)
          .map(([k, v]) => `${pad}${k}: ${typeof v === "object" ? "\n" + toYaml(v, indent + 1) : v}`)
          .join("\n") + "\n";
      };
      return toYaml(obj);
    }

    // fallback to JSON string
    return json;
  }

  // Main entry: answer a question string using a provided knowledge text (can be long)
  // Returns string in the chosen output format
  async answerFromText(question: string, knowledgeText: string) {
    // 1) split text into chunks
    const rawChunks = await this.splitter.splitText(knowledgeText);
    // rawChunks might be an array of strings or Documents; normalize to strings
    const chunks: string[] = rawChunks.map((c: any) => (typeof c === "string" ? c : c.pageContent ?? c.text ?? JSON.stringify(c)));

    // 2) choose top relevant chunks (simple scoring)
    const scored = chunks.map((c) => ({ text: c, score: this.scoreRelevance(question, c) }));
    scored.sort((a, b) => b.score - a.score);
    // pick top 3 chunks as context (configurable if you want)
    const topK = Math.min(3, scored.length);
    const selected = scored.slice(0, topK).map((s) => s.text);

    // 3) Optionally add context from memory (last N items)
    const memoryContext = this.memory.map((m) => m.text).join("\n\n");
    const memoryNote = memoryContext ? `Memory:\n${memoryContext}\n\n` : "";

    // 4) Build messages and call model
    const system = this.opts.systemPrompt;
    const userPrompt = [
      `${memoryNote}Context (most relevant chunks):`,
      ...selected.map((c, i) => `--- Chunk ${i + 1} ---\n${c}`),
      `\nUser question: ${question}`,
      `\nPlease answer concisely. If you cite source text, keep it brief (just the chunk index).`,
      // For structured-output compatibility, we still expect plain text answer here; caller will wrap to structured.
    ].join("\n\n");

    const messages = [
      ["system", system],
      ["user", userPrompt],
    ];

    const llmRes = await this.model.invoke(messages);
    const answerText = typeof llmRes === "string" ? llmRes : llmRes?.content ?? JSON.stringify(llmRes);

    // 5) Add the Q/A to memory per memory config (store either the answer or the selected context)
    await this.manageMemoryAdd({ text: `Q: ${question}\nA: ${answerText}`, meta: { time: Date.now() } });

    // 6) Build structured output object
    const outputObj = {
      answer: answerText,
      sources: selected.map((s, i) => ({ index: i + 1, excerpt: s.slice(0, 400) })), // short excerpt
      memorySummary: this.memory.map((m) => (m.meta?.summarized ? { summarized: true, text: m.text } : { summarized: false, text: m.text })),
    };

    // 7) Convert to desired format and return
    return this.toOutput(outputObj);
  }
}

// Example usage (in another file or top-level async function):
/*
(async () => {
  const agent = await LangChainAgent.create({
    modelSpec: "openai:gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: "You are a concise assistant that cites chunk indices when referencing source text.",
    chunkSize: 800,
    chunkOverlap: 100,
    memory: { type: "summary", target: 6 }, // summaries will be created if memory grows beyond target
    outputFormat: "json",
    jsonpCallbackName: "mycb"
  });

  const knowledge = `Long document text...`; // your knowledge corpus as a single string
  const question = "Summarize the main risks described in the docs.";

  const result = await agent.answerFromText(question, knowledge);
  console.log(result);
})();
*/