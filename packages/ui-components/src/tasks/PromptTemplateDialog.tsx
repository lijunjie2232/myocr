import { useState } from 'react';
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
} from '@mui/material';
import { useAppContext } from '../context/AppContext';

interface PromptTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  directoryId: string;
}

export default function PromptTemplateDialog({ open, onClose, directoryId }: PromptTemplateDialogProps) {
  const { createTask } = useAppContext();
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    if (!promptContent.trim()) {
      setError('Please enter prompt content');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create a task with the prompt content stored in result field
      await createTask(directoryId, {
        name: templateName.trim(),
        imageUrl: '', // No image for prompt templates
        type: 'prompt',
        status: 'completed',
        result: promptContent, // Store prompt content in result field
        ...(templateDescription.trim() && { description: templateDescription.trim() }), // Pass description
      } as any);

      // Reset form
      setTemplateName('');
      setTemplateDescription('');
      setPromptContent('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTemplateName('');
    setTemplateDescription('');
    setPromptContent('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Prompt Template</DialogTitle>
      <DialogContent>
        <Box sx={{ my: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., OCR System Prompt, Image Analysis Prompt"
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            placeholder="Enter a brief description for this template..."
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            rows={8}
            label="Prompt Content"
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            placeholder="Enter your prompt template here..."
            helperText="This template can be used in OCR or other tasks"
            required
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Tip: You can use this template in your OCR or Summary tasks by copying the prompt content.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={isCreating || !templateName.trim() || !promptContent.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
