import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TranslateIcon from '@mui/icons-material/Translate';
import ImageIcon from '@mui/icons-material/Image';
import CodeIcon from '@mui/icons-material/Code';
import type { LLMConfig } from '@myocr/types';
import { llmConfigService } from '../services/configService';

interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  created?: number;
  owned_by?: string;
  capabilities?: {
    completion?: boolean;
    chat?: boolean;
    embedding?: boolean;
    vision?: boolean;
  };
  context_length?: number;
  max_tokens?: number;
}

interface ModelListDialogProps {
  open: boolean;
  onClose: () => void;
  config: LLMConfig;
}

export default function ModelListDialog({ open, onClose, config }: ModelListDialogProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch models when dialog opens or config changes
  useEffect(() => {
    if (open && config) {
      fetchModels();
    }
  }, [open, config]);

  // Don't render if config is null or dialog is closed
  if (!config || !open) {
    return null;
  }

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch models using the service
      const testResult = await llmConfigService.testConnection(config);
      
      if (testResult.success && testResult.models) {
        // Convert string array to ModelInfo array
        const modelInfos: ModelInfo[] = testResult.models.map((modelId: string) => ({
          id: modelId,
          name: modelId,
        }));
        setModels(modelInfos);
      } else {
        // Try direct fetch
        const response = await fetch(`${config.baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const modelInfos: ModelInfo[] = data.data?.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            description: m.description,
            created: m.created,
            owned_by: m.owned_by,
            capabilities: m.capabilities,
            context_length: m.context_length,
            max_tokens: m.max_tokens,
          })) || data.models?.map((m: any) => ({
            id: typeof m === 'string' ? m : m.id,
            name: typeof m === 'string' ? m : (m.name || m.id),
          })) || [];
          
          setModels(modelInfos);
        } else {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  // Filter models by search query
  const filteredModels = models.filter(model => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      model.id.toLowerCase().includes(query) ||
      model.name?.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query) ||
      model.owned_by?.toLowerCase().includes(query)
    );
  });

  // Get model icon based on capabilities or name
  const getModelIcon = (model: ModelInfo) => {
    if (model.capabilities?.vision) return <ImageIcon color="primary" />;
    if (model.capabilities?.chat) return <PsychologyIcon color="success" />;
    if (model.capabilities?.embedding) return <AutoFixHighIcon color="info" />;
    if (model.id.toLowerCase().includes('code')) return <CodeIcon color="warning" />;
    if (model.id.toLowerCase().includes('translate')) return <TranslateIcon color="secondary" />;
    return <ScienceIcon color="action" />;
  };

  // Format timestamp if available
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScienceIcon color="primary" />
            <Typography variant="h6">Available Models - {config.name}</Typography>
          </Box>
          <Tooltip title="Refresh Model List">
            <IconButton onClick={fetchModels} disabled={loading}>
              <RefreshIcon sx={{ ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          {/* API Info */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Server:</strong> {config.baseUrl}
            </Typography>
            <Typography variant="body2">
              <strong>Type:</strong> {config.provider}
            </Typography>
          </Alert>

          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search models by name, description, or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* No Models */}
          {!loading && !error && models.length === 0 && (
            <Alert severity="warning">
              No models found. The API might not support listing models.
            </Alert>
          )}

          {/* Models Grid */}
          {!loading && !error && models.length > 0 && (
            <Grid container spacing={2}>
              {filteredModels.map((model) => (
                <Grid xs={12} sm={6} md={4} key={model.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: 1,
                      borderColor: 'divider',
                      backgroundColor: 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getModelIcon(model)}
                          <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ maxWidth: 200 }}>
                            {model.name || model.id}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 1 }}>
                        {model.id}
                      </Typography>

                      {model.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            mb: 1,
                          }}
                        >
                          {model.description}
                        </Typography>
                      )}

                      {/* Capabilities Chips */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {model.capabilities?.chat && (
                          <Chip label="Chat" size="small" variant="outlined" color="success" />
                        )}
                        {model.capabilities?.completion && (
                          <Chip label="Completion" size="small" variant="outlined" />
                        )}
                        {model.capabilities?.embedding && (
                          <Chip label="Embedding" size="small" variant="outlined" color="info" />
                        )}
                        {model.capabilities?.vision && (
                          <Chip label="Vision" size="small" variant="outlined" color="primary" />
                        )}
                        {model.context_length && (
                          <Chip
                            label={`${(model.context_length / 1000).toFixed(0)}K context`}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        )}
                      </Box>

                      {/* Additional Info */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                        {model.owned_by && (
                          <Typography variant="caption" color="text.secondary">
                            by {model.owned_by}
                          </Typography>
                        )}
                        {model.created && (
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(model.created)}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Results Count */}
          {!loading && !error && models.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Showing {filteredModels.length} of {models.length} models
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
