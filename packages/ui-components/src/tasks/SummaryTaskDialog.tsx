import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ScienceIcon from '@mui/icons-material/Science';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import OcrTaskSelectorDialog from './OcrTaskSelectorDialog';
import PromptTemplateSelectorDialog from './PromptTemplateSelectorDialog';
import TextEditor from './TextEditor';
import { useAppContext } from '../context/AppContext';
import { summaryService } from '@myocr/ipc-client';
import type { Task } from '@myocr/types';

interface SummaryTaskDialogProps {
  open: boolean;
  onClose: () => void;
  directoryId: string;
}

type InputMethod = 'text' | 'file' | 'ocr-tasks';
type MemoryUsage = 'none' | 'trimmed' | 'summarized';
type ResultFormat = 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml';

interface MemoryConfig {
  trigger: number;
  keep: number;
}

interface TextSplitConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export default function SummaryTaskDialog({ open, onClose, directoryId }: SummaryTaskDialogProps) {
  const { createTask, updateTask, llmConfigs } = useAppContext();
  
  // Form state
  const [taskName, setTaskName] = useState('');
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadMode, setUploadMode] = useState<'add-only' | 'add-and-run'>('add-and-run');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OCR tasks selection
  const [ocrSelectorOpen, setOcrSelectorOpen] = useState(false);
  const [selectedOcrTasks, setSelectedOcrTasks] = useState<Task[]>([]);

  // Prompt template selection
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState<Task | null>(null);

  // Text editor for custom prompt
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  
  // Refresh state
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // Memory usage selection
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage>('none');
  
  // Memory configuration parameters
  const [memoryConfig, setMemoryConfig] = useState<MemoryConfig>({
    trigger: 2,
    keep: 1,
  });

  // Text split configuration parameters
  const [textSplitConfig, setTextSplitConfig] = useState<TextSplitConfig>({
    chunkSize: 2000,
    chunkOverlap: 200,
  });

  // Temperature and maxTokens configuration
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(-1);

  // Result format configuration
  const [resultFormat, setResultFormat] = useState<ResultFormat>('plaintext');

  // Get selected API config
  const selectedConfig = useMemo(() => 
    llmConfigs.find(c => c.id === selectedApiId),
    [llmConfigs, selectedApiId]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => 
      file.type === 'text/plain' || file.name.endsWith('.txt')
    );

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setError(null);
    } else {
      setError('Please select valid text files (.txt)');
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!taskName.trim()) {
      setError('Please enter a task name');
      return;
    }

    let content = '';
    
    // Gather content based on input method
    if (inputMethod === 'text') {
      content = textContent;
      if (!content.trim()) {
        setError('Please enter text content');
        return;
      }
    } else if (inputMethod === 'file') {
      if (selectedFiles.length === 0) {
        setError('Please select at least one text file');
        return;
      }
      // Read all selected files
      try {
        const contents = await Promise.all(
          selectedFiles.map(file => file.text())
        );
        content = contents.join('\n\n---\n\n');
      } catch {
        setError('Failed to read text files');
        return;
      }
    } else if (inputMethod === 'ocr-tasks') {
      if (selectedOcrTasks.length === 0) {
        setError('Please select at least one OCR task');
        return;
      }
      // Concatenate OCR task results
      content = selectedOcrTasks.map(t => t.result || '').join('\n\n---\n\n');
      
      if (!content.trim()) {
        setError('Selected OCR tasks have no content');
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create task with content stored in inputText
      const taskId = await createTask(directoryId, {
        name: taskName.trim(),
        imageUrl: '', // No image for summary tasks
        type: 'summary',
        status: uploadMode === 'add-and-run' ? 'processing' : 'pending',
        apiConfigId: selectedApiId || undefined,
        selectedModel: selectedModel || undefined,
        inputText: content, // Store original text in inputText
        customPrompt: customPrompt || undefined, // Store custom prompt - Note: needs to be added to Task type
        result: '', // Empty result initially
        memoryUsage: memoryUsage || undefined,
        memoryConfig: memoryUsage !== 'none' ? memoryConfig : undefined,
        textSplitConfig: textSplitConfig, // Apply to all input methods
        temperature: temperature,
        maxTokens: maxTokens,
        resultFormat: resultFormat,
      });
      
      // Debug: Log the saved configuration
      console.log('Task created with config:', {
        taskId,
        inputMethod,
        textSplitConfig,
      });

      // If add-and-run mode, process with LLM
      if (uploadMode === 'add-and-run') {
        try {
          // Call summary service through IPC
          const result = await summaryService.processSummary({
            text: content,
            prompt: customPrompt || undefined,
            apiConfigId: selectedApiId || '',
            modelId: selectedModel || 'auto',
            taskId: taskId, // Pass task ID for memory tracking
            memoryUsage: memoryUsage || 'none',
            memoryConfig: memoryUsage !== 'none' ? memoryConfig : undefined,
            textSplitConfig: textSplitConfig,
            temperature: temperature,
            maxTokens: maxTokens,
            resultFormat: resultFormat,
          });
          
          // Update task with result
          await updateTask(directoryId, taskId, {
            result: result.summary,
            status: 'completed',
            metadata: result.metadata ? (result.metadata as Record<string, unknown>) : undefined,
          });
          
          console.log(`Summary created for ${taskName}:`, result.summary.substring(0, 100) + '...');
        } catch (err) {
          console.error(`Summary processing failed for ${taskName}:`, err);
          await updateTask(directoryId, taskId, {
            status: 'failed',
            errorMessage: (err as Error).message,
          });
        }
      }

      // Reset form
      setTaskName('');
      setTextContent('');
      setSelectedFiles([]);
      setSelectedOcrTasks([]);
      setSelectedPromptTemplate(null);
      setMemoryUsage('none');
      setMemoryConfig({
        trigger: 2,
        keep: 1,
      });
      setTextSplitConfig({
        chunkSize: 2000,
        chunkOverlap: 200,
      });
      setTemperature(0.7); // Reset to default
      setMaxTokens(-1); // Reset to default
      setResultFormat('plaintext'); // Reset to default
      setInputMethod('text'); // Reset input method to default
      setUploadMode('add-and-run'); // Reset upload mode to default
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setTaskName('');
    setTextContent('');
    setSelectedFiles([]);
    setSelectedOcrTasks([]);
    setSelectedPromptTemplate(null);
    setMemoryUsage('none');
    setMemoryConfig({
      trigger: 2,
      keep: 1,
    });
    setTextSplitConfig({
      chunkSize: 2000,
      chunkOverlap: 200,
    });
    setTemperature(0.7); // Reset to default
    setMaxTokens(-1); // Reset to default
    setResultFormat('plaintext'); // Reset to default
    setError(null);
    setSelectedApiId('');
    setSelectedModel('');
    setCustomPrompt('');
    setInputMethod('text'); // Reset input method to default
    setUploadMode('add-and-run'); // Reset upload mode to default
    onClose();
  };

  const handleOpenOcrSelector = () => {
    setOcrSelectorOpen(true);
  };

  const handleConfirmOcrSelection = (tasks: Task[]) => {
    setSelectedOcrTasks(tasks);
    setOcrSelectorOpen(false);
  };

  const handleOpenPromptSelector = () => {
    setPromptSelectorOpen(true);
  };

  const handleConfirmPromptSelection = (template: Task | null) => {
    if (template) {
      // Set the custom prompt from template
      setSelectedPromptTemplate(template);
      const promptContent = template.result || '';
      setCustomPrompt(promptContent);
      console.log('Prompt template imported:', {
        templateName: template.name,
        promptLength: promptContent.length,
        currentCustomPrompt: promptContent.substring(0, 50) + '...',
      });
      // Note: No need to open editor here, just import the content
      // User can click edit button if they want to edit in full-screen editor
    }
    setPromptSelectorOpen(false);
  };

  const handleOpenPromptEditor = () => {
    console.log('Opening prompt editor with custom prompt:', {
      customPromptLength: customPrompt.length,
      customPromptPreview: customPrompt.substring(0, 50) + '...',
      hasSelectedTemplate: !!selectedPromptTemplate,
    });
    setPromptEditorOpen(true);
  };

  const handleSavePromptContent = async (newContent: string) => {
    console.log('Saving prompt content from editor:', {
      oldLength: customPrompt.length,
      newLength: newContent.length,
    });
    setCustomPrompt(newContent);
    setPromptEditorOpen(false);
  };

  const handleRefreshModels = async () => {
    if (!selectedApiId || !selectedConfig) return;
    
    setIsRefreshingModels(true);
    setRefreshMessage(null);
    
    try {
      // Import llmConfigService dynamically
      const { llmConfigService } = await import('../services/configService');
      const result = await llmConfigService.testConnection(selectedConfig);
      
      if (result.success && result.models) {
        // Update state to reflect new models
        setSelectedModel(''); // Reset model selection
        
        // Show success message
        setRefreshMessage(`Successfully refreshed! Found ${result.models.length} models.`);
        
        // Clear message after 3 seconds
        setTimeout(() => setRefreshMessage(null), 3000);
      } else {
        setRefreshMessage('No models found or connection failed.');
        setTimeout(() => setRefreshMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to refresh models:', error);
      setRefreshMessage('Failed to refresh models. Please check your connection.');
      setTimeout(() => setRefreshMessage(null), 3000);
    } finally {
      setIsRefreshingModels(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Create Summary Task
        <Chip 
          label={`Input: ${inputMethod}`} 
          size="small" 
          sx={{ ml: 2 }}
        />
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
            placeholder="e.g., Summarize Document, Analyze Text"
            sx={{ mb: 2 }}
            required
          />

          {/* Input Method Selection */}
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
            Input Method:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={inputMethod === 'text' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setInputMethod('text')}
            >
              <DescriptionIcon sx={{ mr: 0.5 }} fontSize="small" />
              Text Input
            </Button>
            <Button
              variant={inputMethod === 'file' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setInputMethod('file')}
            >
              <FolderIcon sx={{ mr: 0.5 }} fontSize="small" />
              Upload Files
            </Button>
            <Button
              variant={inputMethod === 'ocr-tasks' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setInputMethod('ocr-tasks')}
            >
              <ScienceIcon sx={{ mr: 0.5 }} fontSize="small" />
              From OCR Tasks
            </Button>
          </Box>

          {/* Text Input */}
          {inputMethod === 'text' && (
            <TextField
              fullWidth
              multiline
              rows={8}
              label="Text Content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Enter or paste your text here..."
              required
            />
          )}

          {/* File Upload */}
          {inputMethod === 'file' && (
            <Box>
              <Box
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                  mb: 2,
                }}
              >
                <input
                  accept=".txt,text/plain"
                  type="file"
                  id="text-file-upload"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <label htmlFor="text-file-upload">
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6">Click to upload text files</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supported format: TXT (Multiple files supported)
                  </Typography>
                </label>
              </Box>

              {selectedFiles.length > 0 && (
                <List dense>
                  {selectedFiles.map((file, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <DescriptionIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024).toFixed(1)} KB`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* OCR Tasks Selection */}
          {inputMethod === 'ocr-tasks' && (
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  Selected OCR Tasks:
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FolderIcon />}
                  onClick={handleOpenOcrSelector}
                >
                  Browse All Directories
                </Button>
              </Box>
              
              {selectedOcrTasks.length === 0 ? (
                <Box
                  sx={{
                    border: '2px dashed #ccc',
                    borderRadius: 1,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={handleOpenOcrSelector}
                >
                  <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Click to select from completed OCR tasks across all directories
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {selectedOcrTasks.map((task) => (
                    <ListItem
                      key={task.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setSelectedOcrTasks(prev => prev.filter(t => t.id !== task.id))}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <DescriptionIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.name}
                        secondary={
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {task.result?.substring(0, 80) || 'No content'}...
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              
              {selectedOcrTasks.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={`${selectedOcrTasks.length} task(s) selected`} 
                    size="small"
                    color="primary"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Total content will be concatenated
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* API Selection */}
          {llmConfigs.length > 0 && (
            <Box sx={{ mt: 2 }}>
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
                  startAdornment={selectedConfig && <ScienceIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  {llmConfigs.map((config) => (
                    <MenuItem key={config.id} value={config.id}>
                      {config.name} ({config.provider})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Model Selection - Model is now stored per-task */}
              {selectedConfig && selectedConfig.models && selectedConfig.models.length > 0 && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Select
                      value={selectedModel}
                      label="Model"
                      onChange={(e) => setSelectedModel(e.target.value)}
                      sx={{ flexGrow: 1 }}
                    >
                      <MenuItem value="auto">Auto</MenuItem>
                      {selectedConfig.models.map((model) => (
                        <MenuItem key={model} value={model}>
                          {model}
                        </MenuItem>
                      ))}
                    </Select>
                    <Tooltip title="Refresh model list">
                      <IconButton 
                        onClick={handleRefreshModels} 
                        size="small"
                        disabled={isRefreshingModels}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {refreshMessage && (
                    <Alert severity={refreshMessage.includes('Successfully') ? 'success' : 'warning'} sx={{ mt: 1, py: 0.5 }}>
                      {refreshMessage}
                    </Alert>
                  )}
                </FormControl>
              )}
            </Box>
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
              helperText={selectedPromptTemplate ? `Imported from: ${selectedPromptTemplate.name}` : undefined}
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
                onChange={(e) => setMemoryUsage(e.target.value as MemoryUsage)}
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

          {/* Upload Mode Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Processing Mode:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={uploadMode === 'add-only' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUploadMode('add-only')}
              >
                Add Only
              </Button>
              <Button
                variant={uploadMode === 'add-and-run' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUploadMode('add-and-run')}
              >
                Add & Run
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {uploadMode === 'add-only' 
                ? 'Task will be added without processing (API and model can still be selected for later use)' 
                : 'Task will be processed with LLM immediately after creation'}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={isProcessing || !taskName.trim()}
        >
          {isProcessing 
            ? 'Creating...' 
            : uploadMode === 'add-only'
              ? 'Add Task'
              : 'Create & Run'
          }
        </Button>
      </DialogActions>
    </Dialog>

    <OcrTaskSelectorDialog
      open={ocrSelectorOpen}
      onClose={() => setOcrSelectorOpen(false)}
      onConfirm={handleConfirmOcrSelection}
    />
    
    <PromptTemplateSelectorDialog
      open={promptSelectorOpen}
      onClose={() => setPromptSelectorOpen(false)}
      onConfirm={handleConfirmPromptSelection}
    />
    
    <TextEditor
      open={promptEditorOpen}
      onClose={() => setPromptEditorOpen(false)}
      title="Edit Custom Prompt"
      content={customPrompt}
      onSave={handleSavePromptContent}
    />
    </>
  );
}
