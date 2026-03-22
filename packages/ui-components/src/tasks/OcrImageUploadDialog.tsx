import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ScienceIcon from '@mui/icons-material/Science';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import { useAppContext } from '../context/AppContext';
import { ocrService } from '@myocr/ipc-client';
import { fileToDataUrl } from '../utils';
import PromptTemplateSelectorDialog from './PromptTemplateSelectorDialog';
import TextEditor from './TextEditor';
import type { Task } from '@myocr/types';

interface OcrImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  directoryId?: string;
}

interface PendingImage {
  file: File;
  previewUrl: string;
  imageUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export default function OcrImageUploadDialog({ open, onClose, directoryId }: OcrImageUploadDialogProps) {
  const { createTask, updateTask, llmConfigs } = useAppContext();
  const [selectedImages, setSelectedImages] = useState<PendingImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadMode, setUploadMode] = useState<'add-only' | 'add-and-ocr'>('add-and-ocr');
  const [temperature, setTemperature] = useState<number>(0.6);
  const [maxTokens, setMaxTokens] = useState<number>(-1);
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Get selected API config
  const selectedConfig = useMemo(() => 
    llmConfigs.find(c => c.id === selectedApiId),
    [llmConfigs, selectedApiId]
  );

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: PendingImage[] = [];
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        newImages.push({
          file,
          previewUrl,
          imageUrl: '', // Will be generated during upload
          status: 'pending',
        });
      }
    });

    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages]);
      setError(null);
    } else {
      setError('Please select valid image files');
    }
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages(prev => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleUpload = async () => {
    if (selectedImages.length === 0 || !directoryId) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i];
        
        // Generate image URL
        const imageUrl = await fileToDataUrl(image.file);
        
        // Create task with API/model configuration
        const taskId: string = await createTask(directoryId, {
          name: image.file.name,
          imageUrl,
          type: 'ocr',
          status: uploadMode === 'add-and-ocr' ? 'processing' : 'pending',
          apiConfigId: selectedApiId || undefined,
          selectedModel: selectedModel || undefined,
          temperature: temperature,
          maxTokens: maxTokens,
        });

        // If add-and-ocr mode, process OCR through IPC
        if (uploadMode === 'add-and-ocr') {
          try {
            console.log('[OcrImageUploadDialog] Processing OCR:', {
              image: image.file.name,
              apiConfigId: selectedApiId,
              selectedModel: selectedModel,
              temperature: temperature,
              maxTokens: maxTokens,
              customPrompt: customPrompt || undefined,
            });
            
            // Call OCR service through Electron IPC
            const ocrResult = await ocrService.processImage({
              image: image.file,
              apiConfigId: selectedApiId || undefined,
              modelId: selectedModel || undefined,
              temperature: temperature,
              maxTokens: maxTokens,
              prompt: customPrompt || undefined,
            });
            
            // Update task with result
            updateTask(directoryId, taskId, {
              result: ocrResult.text,
              status: 'completed',
            });

            console.log(`OCR completed for ${image.file.name}`);
          } catch (err) {
            console.error(`OCR failed for ${image.file.name}:`, err);
            updateTask(directoryId, taskId, {
              status: 'failed',
              errorMessage: (err as Error).message,
            });
          }
        }
      }

      onClose();
      setSelectedImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    // Clean up object URLs
    selectedImages.forEach(img => {
      URL.revokeObjectURL(img.previewUrl);
    });
    setSelectedImages([]);
    setError(null);
    setSelectedApiId('');
    setSelectedModel('');
    setCustomPrompt('');
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

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upload Images for OCR
        {selectedImages.length > 0 && (
          <Chip 
            label={`${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''} selected`} 
            size="small" 
            sx={{ ml: 2 }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ my: 2 }}>
          {/* Upload Area */}
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
              accept="image/*"
              type="file"
              id="image-upload"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <label htmlFor="image-upload">
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="h6">Click to upload images</Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: JPG, PNG, GIF, WebP (Multiple files supported)
              </Typography>
            </label>
          </Box>

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Selected Images:
              </Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                gap: 2,
                mt: 1,
              }}>
                {selectedImages.map((image, index) => (
                  <Box key={index} sx={{ position: 'relative' }}>
                    <img
                      src={image.previewUrl}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveImage(index)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 1)',
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block', 
                        mt: 0.5, 
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {image.file.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* API Selection */}
          {llmConfigs.length > 0 ? (
            <>
              <FormControl fullWidth required sx={{ mb: 2 }}>
                <InputLabel>LLM API Configuration</InputLabel>
                <Select
                  value={selectedApiId}
                  label="LLM API Configuration"
                  onChange={(e) => {
                    setSelectedApiId(e.target.value);
                    setSelectedModel(''); // Reset model when API changes
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

              {/* Model Selection */}
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
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No LLM API configurations found. Please add an API configuration in Settings first.
            </Alert>
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
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty for default: 'Please extract all text from this image.'"
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
            sx={{ mb: 2 }}
          />

          {/* Upload Mode Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Upload Mode:
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
                variant={uploadMode === 'add-and-ocr' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setUploadMode('add-and-ocr')}
              >
                Add & OCR
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {uploadMode === 'add-only' 
                ? 'Images will be added to the directory without OCR processing (API and model can still be selected for later use)' 
                : 'Images will be processed with OCR immediately after upload'}
            </Typography>
          </Box>

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography>
                Processing {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''}...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={selectedImages.length === 0 || isProcessing || !directoryId || (uploadMode === 'add-and-ocr' && llmConfigs.length > 0 && !selectedApiId)}
        >
          {isProcessing 
            ? `Processing ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}...` 
            : uploadMode === 'add-only'
              ? `Add ${selectedImages.length} Image${selectedImages.length > 1 ? 's' : ''}`
              : `Upload & OCR ${selectedImages.length} Image${selectedImages.length > 1 ? 's' : ''}`
          }
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
