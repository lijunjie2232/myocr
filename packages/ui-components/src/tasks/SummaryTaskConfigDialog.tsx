import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import EditIcon from '@mui/icons-material/Edit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useAppContext } from '../context/AppContext';
import TextEditor from './TextEditor';
import PromptTemplateSelectorDialog from './PromptTemplateSelectorDialog';
import type { Task } from '@myocr/types';

type ResultFormat = 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml';

interface SummaryTaskConfigDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  directoryId: string;
}

export default function SummaryTaskConfigDialog({
  open,
  onClose,
  task,
  directoryId,
}: SummaryTaskConfigDialogProps) {
  const { llmConfigs, updateTask } = useAppContext();
  
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [memoryUsage, setMemoryUsage] = useState<'none' | 'trimmed' | 'summarized'>('none');
  const [memoryConfig, setMemoryConfig] = useState<{ trigger: number; keep: number }>({
    trigger: 2,
    keep: 1,
  });
  const [textSplitConfig, setTextSplitConfig] = useState<{ chunkSize: number; chunkOverlap: number }>({
    chunkSize: 2000,
    chunkOverlap: 200,
  });
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(-1);
  const [resultFormat, setResultFormat] = useState<ResultFormat>('plaintext');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Text editor for custom prompt
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  // Prompt template selection
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);

  // Get selected API config
  const selectedConfig = useMemo(() => 
    llmConfigs.find(c => c.id === selectedApiId),
    [llmConfigs, selectedApiId]
  );

  // Initialize form with task config
  useEffect(() => {
    if (task && open) {
      setTaskName(task.name);
      setSelectedApiId(task.apiConfigId || '');
      setSelectedModel(task.selectedModel || '');
      setCustomPrompt(task.customPrompt || '');
      setMemoryUsage(task.memoryUsage || 'none');
      setMemoryConfig(task.memoryConfig || { trigger: 2, keep: 1 });
      setTextSplitConfig(task.textSplitConfig || { chunkSize: 2000, chunkOverlap: 200 });
      setTemperature(task.temperature ?? 0.7); // Default to 0.7 for Summary
      setMaxTokens(task.maxTokens ?? -1); // Default to -1 (unlimited)
      setResultFormat(task.resultFormat || 'plaintext'); // Default to plaintext
      setError(null);
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!task) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateTask(directoryId, task.id, {
        name: taskName.trim() || 'Untitled Task',
        apiConfigId: selectedApiId || undefined,
        selectedModel: selectedModel || undefined,
        customPrompt: customPrompt || undefined,
        memoryUsage: memoryUsage || undefined,
        memoryConfig: memoryUsage !== 'none' ? memoryConfig : undefined,
        textSplitConfig: textSplitConfig,
        temperature: temperature,
        maxTokens: maxTokens,
        resultFormat: resultFormat,
      });

      // Note: Model selection is now per-task, not per-LLM-config
      // The model is already stored in the task itself

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleOpenPromptEditor = () => {
    console.log('Opening prompt editor with custom prompt:', {
      customPromptLength: customPrompt.length,
      customPromptPreview: customPrompt.substring(0, 50) + '...',
      taskId: task?.id,
    });
    setPromptEditorOpen(true);
  };

  const handleSavePromptContent = async (newContent: string) => {
    console.log('Saving prompt content from editor:', {
      oldLength: customPrompt.length,
      newLength: newContent.length,
      taskId: task?.id,
    });
    setCustomPrompt(newContent);
    setPromptEditorOpen(false);
  };

  const handleOpenPromptSelector = () => {
    setPromptSelectorOpen(true);
  };

  const handleConfirmPromptSelection = (template: Task | null) => {
    if (template) {
      // Set the custom prompt from template
      const promptContent = template.result || '';
      setCustomPrompt(promptContent);
      console.log('Prompt template imported:', {
        templateName: template.name,
        promptLength: promptContent.length,
        currentCustomPrompt: promptContent.substring(0, 50) + '...',
        taskId: task?.id,
      });
      // Note: No need to open editor here, just import the content
      // User can click edit button if they want to edit in full-screen editor
    }
    setPromptSelectorOpen(false);
  };

  if (!task) return null;

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit Task Configuration
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ my: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Task Name */}
          <TextField
            fullWidth
            label="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Enter task name"
            sx={{ mb: 2 }}
            required
          />

          {/* API Configuration Selection */}
          {llmConfigs.length > 0 ? (
            <FormControl fullWidth required sx={{ mb: 2 }}>
              <InputLabel>LLM API Configuration</InputLabel>
              <Select
                value={selectedApiId}
                label="LLM API Configuration"
                onChange={(e) => {
                  setSelectedApiId(e.target.value);
                  // Reset model when API changes - model is now stored in task
                  setSelectedModel('');
                }}
                startAdornment={<ScienceIcon sx={{ mr: 1, color: 'text.secondary' }} />}
              >
                {llmConfigs.map((config) => (
                  <MenuItem key={config.id} value={config.id}>
                    {config.name} ({config.provider})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No LLM API configurations found. Please add an API configuration in Settings first.
            </Alert>
          )}

          {/* Model Selection - Model is now stored per-task */}
          {selectedConfig && selectedConfig.models && selectedConfig.models.length > 0 && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={selectedModel}
                label="Model"
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {selectedConfig.models.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Custom Prompt */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                Custom Prompt (optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Open in text editor">
                  <IconButton
                    size="small"
                    onClick={handleOpenPromptEditor}
                    color="primary"
                    // The editor will show the current value of customPrompt state
                    // and save any changes back to customPrompt state
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleOpenPromptSelector}
                  // Import prompt template content to customPrompt input box
                >
                  Import from Template
                </Button>
              </Box>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty for default summarization prompt"
              // customPrompt can be updated by:
              // 1. Manually typing in this input box
              // 2. Importing from template (sets customPrompt to template.result)
              // 3. Editing in text editor (saves edited content back to customPrompt)
            />
          </Box>

          {/* Memory Usage Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
              Agent Memory Usage:
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Memory Mode</InputLabel>
              <Select
                value={memoryUsage}
                label="Memory Mode"
                onChange={(e) => setMemoryUsage(e.target.value as 'none' | 'trimmed' | 'summarized')}
              >
                <MenuItem value="none">
                  <Box>
                    <Typography variant="body2">Not Use Memory</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Process without using agent memory
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="trimmed">
                  <Box>
                    <Typography variant="body2">Trimmed Memory</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Use condensed/trimmed version of agent memory
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="summarized">
                  <Box>
                    <Typography variant="body2">Summarized Memory</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Use summarized version of agent memory
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Memory Configuration Parameters */}
          {memoryUsage !== 'none' && (
            <Paper 
              sx={{ 
                p: 2, 
                mb: 2, 
                backgroundColor: 'action.hover',
                borderLeft: 3,
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                Memory Configuration Parameters
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Trigger"
                  value={memoryConfig.trigger}
                  onChange={(e) => setMemoryConfig({
                    ...memoryConfig,
                    trigger: parseInt(e.target.value) || 0,
                  })}
                  inputProps={{ 
                    min: 0, 
                    max: 100,
                    step: 1,
                  }}
                  helperText="Number of messages to trigger memory"
                  size="small"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Keep"
                  value={memoryConfig.keep}
                  onChange={(e) => setMemoryConfig({
                    ...memoryConfig,
                    keep: parseInt(e.target.value) || 0,
                  })}
                  inputProps={{ 
                    min: 0, 
                    max: 100,
                    step: 1,
                  }}
                  helperText="Number of memories to keep"
                  size="small"
                />
              </Box>
            </Paper>
          )}

          {/* Text Split Configuration */}
          <Paper 
            sx={{ 
              p: 2, 
              mb: 2, 
              backgroundColor: 'action.hover',
              borderLeft: 3,
              borderColor: 'info.main',
            }}
          >
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              Text Split Configuration
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Chunk Size"
                value={textSplitConfig.chunkSize}
                onChange={(e) => setTextSplitConfig({
                  ...textSplitConfig,
                  chunkSize: parseInt(e.target.value) || 0,
                })}
                inputProps={{ 
                  min: 100, 
                  max: 10000,
                  step: 100,
                }}
                helperText="Maximum characters per chunk (default: 2000)"
                size="small"
              />
              <TextField
                fullWidth
                type="number"
                label="Chunk Overlap"
                value={textSplitConfig.chunkOverlap}
                onChange={(e) => setTextSplitConfig({
                  ...textSplitConfig,
                  chunkOverlap: parseInt(e.target.value) || 0,
                })}
                inputProps={{ 
                  min: 0, 
                  max: 1000,
                  step: 50,
                }}
                helperText="Character overlap between chunks (default: 200)"
                size="small"
              />
            </Box>
          </Paper>

          {/* Temperature Configuration */}
          <TextField
            fullWidth
            type="number"
            label="Temperature"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
            inputProps={{
              min: 0,
              max: 2,
              step: 0.1,
            }}
            helperText="Controls randomness (0.0 = deterministic, 2.0 = very random). Default: 0.7"
            sx={{ mb: 2 }}
          />

          {/* Max Tokens Configuration */}
          <TextField
            fullWidth
            type="number"
            label="Max Tokens"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || -1)}
            inputProps={{
              min: -1,
              step: 1,
            }}
            helperText="Maximum tokens to generate (-1 for unlimited). Default: -1"
            sx={{ mb: 2 }}
          />

          {/* Result Format Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Result Format</InputLabel>
            <Select
              value={resultFormat}
              label="Result Format"
              onChange={(e) => setResultFormat(e.target.value as ResultFormat)}
            >
              <MenuItem value="plaintext">Plaintext (Default)</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="jsonp">JSONP</MenuItem>
              <MenuItem value="yaml">YAML</MenuItem>
              <MenuItem value="xml">XML</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isSaving || llmConfigs.length === 0}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
    
    <TextEditor
      open={promptEditorOpen}
      onClose={() => setPromptEditorOpen(false)}
      title="Edit Custom Prompt"
      content={customPrompt}
      onSave={handleSavePromptContent}
    />
    
    <PromptTemplateSelectorDialog
      open={promptSelectorOpen}
      onClose={() => setPromptSelectorOpen(false)}
      onConfirm={handleConfirmPromptSelection}
    />
    </>
  );
}
