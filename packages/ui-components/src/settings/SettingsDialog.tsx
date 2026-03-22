import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScienceIcon from '@mui/icons-material/Science';
import ViewListIcon from '@mui/icons-material/ViewList';
import type { LLMConfig } from '@myocr/types';
import { useAppContext } from '../context/AppContext';
import { llmConfigService } from '../services/configService';
import ModelListDialog from './ModelListDialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { llmConfigs, addLLMConfig, updateLLMConfig, deleteLLMConfig } = useAppContext();
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<LLMConfig>>({
    name: '',
    baseUrl: '',
    provider: 'openai',
    apiKey: '',
  });
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; timestamp: number }>>({});
  const [autoTesting, setAutoTesting] = useState(false);
  const [modelListDialogOpen, setModelListDialogOpen] = useState(false);
  const [selectedConfigForModels, setSelectedConfigForModels] = useState<LLMConfig | null>(null);

  const handleSave = () => {
    if (!formData.name || !formData.baseUrl || !formData.apiKey) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingConfig) {
      updateLLMConfig(editingConfig.id, formData as Partial<LLMConfig>);
    } else {
      const newConfig: LLMConfig = {
        id: crypto.randomUUID(),
        name: formData.name!,
        provider: (formData.provider as 'openai' | 'anthropic' | 'ollama' | 'custom') || 'custom',
        model: '',
        baseUrl: formData.baseUrl!,
        apiKey: formData.apiKey!,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addLLMConfig(newConfig);
    }

    // Clear test results for this config
    const testKey = editingConfig?.id || 'new-config';
    setTestResults(prev => {
      const updated = { ...prev };
      delete updated[testKey];
      return updated;
    });

    setConfigDialogOpen(false);
    setEditingConfig(null);
    setFormData({});
  };

  const handleTestConnection = async (config: LLMConfig, testKey?: string) => {
    const key = testKey || config.id;
    setTestingConfig(key);
    try {
      const result = await llmConfigService.testConnection(config);
      
      setTestResults(prev => ({
        ...prev,
        [key]: {
          success: result.success,
          message: result.message,
          timestamp: Date.now(),
        },
      }));

      // Show success/error message only for failed tests
      if (!result.success) {
        alert('Connection Test Failed:\n' + result.message);
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [key]: {
          success: false,
          message: (error as Error).message,
          timestamp: Date.now(),
        },
      }));
      alert('Connection Test Error: ' + (error as Error).message);
    } finally {
      setTestingConfig(null);
    }
  };



  const handleAddNew = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      baseUrl: '',
      provider: 'openai',
      apiKey: '',
    });
    setConfigDialogOpen(true);
  };

  const handleEdit = (config: LLMConfig) => {
    setEditingConfig(config);
    setFormData(config);
    setConfigDialogOpen(true);
  };

  const handleCloseConfigDialog = () => {
    // Clear test results for this config
    const testKey = editingConfig?.id || 'new-config';
    setTestResults(prev => {
      const updated = { ...prev };
      delete updated[testKey];
      return updated;
    });

    setConfigDialogOpen(false);
    setEditingConfig(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this configuration?')) {
      deleteLLMConfig(id);
    }
  };

  const handleViewModels = (config: LLMConfig) => {
    setSelectedConfigForModels(config);
    setModelListDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            LLM Configuration
            {autoTesting && (
              <Chip
                label="Auto-Testing..."
                size="small"
                color="info"
                variant="outlined"
                icon={<CircularProgress size={16} />}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Configured APIs</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ScienceIcon />}
                onClick={async () => {
                  setAutoTesting(true);
                  // Test all configs
                  for (const config of llmConfigs) {
                    if (!testResults[config.id]) {
                      await handleTestConnection(config);
                    }
                  }
                  setAutoTesting(false);
                }}
                disabled={llmConfigs.length === 0 || autoTesting}
              >
                Test All Connections
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleAddNew}
              >
                Add New
              </Button>
            </Box>
          </Box>
              <List>
              {llmConfigs.map((config) => (
                <ListItem
                  key={config.id}
                  secondaryAction={
                    <>
                      <IconButton 
                        edge="end" 
                        onClick={() => handleViewModels(config)}
                        title="View Available Models"
                      >
                        <ViewListIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        onClick={() => handleTestConnection(config)}
                        disabled={testingConfig === config.id}
                        title="Test Connection"
                      >
                        {testingConfig === config.id ? (
                          <CircularProgress size={24} />
                        ) : testResults[config.id]?.success ? (
                          <CheckCircleIcon color="success" />
                        ) : testResults[config.id] ? (
                          <ErrorIcon color="error" />
                        ) : (
                          <ScienceIcon />
                        )}
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleEdit(config)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleDelete(config.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </>
                  }
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">{config.name}</Typography>
                          {testResults[config.id] && (
                            <Chip
                              label={testResults[config.id].success ? 'Connected' : 'Failed'}
                              size="small"
                              color={testResults[config.id].success ? 'success' : 'error'}
                              variant="outlined"
                            />
                          )}
                        </Box>
                        <Box component="span" sx={{ display: 'block', typography: 'body2', color: 'text.secondary' }}>
                          {config.baseUrl}
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box component="span" sx={{ display: 'block', typography: 'body2', mt: 0.5 }}>
                          Type: {config.provider}
                        </Box>
                        {testResults[config.id] && (
                          <Alert
                            severity={testResults[config.id].success ? 'success' : 'error'}
                            sx={{ mt: 1, mb: 1 }}
                          >
                            {testResults[config.id].message}
                          </Alert>
                        )}
                        <Box component="span" sx={{ display: 'block', mt: 1 }}>
                          <Button
                            size="small"
                            startIcon={<ScienceIcon />}
                            onClick={() => handleTestConnection(config)}
                            disabled={testingConfig === config.id}
                            variant={testingConfig === config.id ? 'outlined' : 'text'}
                          >
                            {testingConfig === config.id ? 'Testing...' : 'Test Connection'}
                          </Button>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              {llmConfigs.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No configurations yet. Click "Add New" to create one.
                </Typography>
              )}
            </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={handleCloseConfigDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingConfig ? 'Edit LLM Configuration' : 'Add New LLM Configuration'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Configuration Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              autoFocus
            />
            <TextField
              label="Base URL"
              value={formData.baseUrl || ''}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              fullWidth
              required
              placeholder="https://api.example.com/v1"
            />
            <TextField
              label="API Type"
              select
              value={formData.provider || 'openai'}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </TextField>
            <TextField
              label="API Key"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              fullWidth
              required
              type="password"
            />
            
            {/* Test Connection Button */}
            {formData.baseUrl && formData.apiKey && (
              <Box sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ScienceIcon />}
                  onClick={() => {
                    const testKey = editingConfig?.id || 'new-config';
                    const testConfig: LLMConfig = {
                      id: editingConfig?.id || crypto.randomUUID(),
                      name: formData.name!,
                      baseUrl: formData.baseUrl!,
                      provider: formData.provider as 'openai' | 'anthropic' | 'custom',
                      apiKey: formData.apiKey!,
                      models: editingConfig?.models || [],
                      createdAt: editingConfig?.createdAt || new Date(),
                      updatedAt: editingConfig?.updatedAt || new Date(),
                    };
                    handleTestConnection(testConfig, testKey);
                  }}
                  disabled={testingConfig !== null}
                  fullWidth
                >
                  {testingConfig ? 'Testing...' : 'Test Connection Before Save'}
                </Button>
                {testResults[editingConfig?.id || 'new-config'] && (
                  <Alert
                    severity={testResults[editingConfig?.id || 'new-config'].success ? 'success' : 'error'}
                    sx={{ mt: 1 }}
                  >
                    {testResults[editingConfig?.id || 'new-config'].message}
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfigDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingConfig ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Model List Dialog */}
      <ModelListDialog
        open={modelListDialogOpen}
        onClose={() => {
          setModelListDialogOpen(false);
          setSelectedConfigForModels(null);
        }}
        config={selectedConfigForModels!}
      />
    </>
  );
}