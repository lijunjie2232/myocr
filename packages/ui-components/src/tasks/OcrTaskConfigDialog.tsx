import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import { useAppContext } from '../context/AppContext';
import type { Task } from '@myocr/types';
import PromptTemplateSelectorDialog from './PromptTemplateSelectorDialog';
import TextEditor from './TextEditor';

interface OcrTaskConfigDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  directoryId: string;
}

export default function OcrTaskConfigDialog({
  open,
  onClose,
  task,
  directoryId,
}: OcrTaskConfigDialogProps) {
  const { llmConfigs, updateTask } = useAppContext();
  
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.6);
  const [maxTokens, setMaxTokens] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

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
      setTemperature(task.temperature ?? 0.6); // Default to 0.6 for OCR
      setMaxTokens(task.maxTokens ?? -1); // Default to -1 (unlimited)
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
        temperature: temperature,
        maxTokens: maxTokens,
      });

      // Note: Model selection is now per-task, not per-LLM-config
      // The model will be stored in the task itself

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

  const handleOpenPromptSelector = () => {
    setPromptSelectorOpen(true);
  };

  const handlePromptTemplateSelect = (template: Task | null) => {
    if (template && template.result) {
      setCustomPrompt(template.result);
    }
    setPromptSelectorOpen(false);
  };

  const handleOpenTextEditor = () => {
    setTextEditorOpen(true);
  };

  const handleSavePrompt = async (newContent: string) => {
    setIsSavingPrompt(true);
    try {
      setCustomPrompt(newContent);
    } finally {
      setIsSavingPrompt(false);
      setTextEditorOpen(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit OCR Task Configuration
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
                <MenuItem value="auto">Auto</MenuItem>
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
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleOpenPromptSelector}
                >
                  Import from Template
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleOpenTextEditor}
                >
                  Edit
                </Button>
              </Box>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Custom Prompt (optional)"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty for default OCR prompt"
              helperText="Use a template for consistent prompts across tasks"
            />
          </Box>

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
            helperText="Controls randomness (0.0 = deterministic, 2.0 = very random). Default: 0.6"
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
          />
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

      {/* Prompt Template Selector Dialog */}
      <PromptTemplateSelectorDialog
        open={promptSelectorOpen}
        onClose={() => setPromptSelectorOpen(false)}
        onConfirm={handlePromptTemplateSelect}
      />

      {/* Text Editor Dialog */}
      <TextEditor
        open={textEditorOpen}
        onClose={() => setTextEditorOpen(false)}
        title="Edit Custom Prompt"
        content={customPrompt}
        onSave={handleSavePrompt}
        isSaving={isSavingPrompt}
      />
    </Dialog>
  );
}
