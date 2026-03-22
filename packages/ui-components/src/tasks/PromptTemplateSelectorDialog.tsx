import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAppContext } from '../context/AppContext';
import type { Task, Directory } from '@myocr/types';

interface PromptTemplateSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTemplate: Task | null) => void;
}

interface DirectoryWithTasks extends Directory {
  expanded: boolean;
  tasks: Task[];
}

export default function PromptTemplateSelectorDialog({ open, onClose, onConfirm }: PromptTemplateSelectorDialogProps) {
  const { directories } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Reset dialog state when closed
  const handleReset = () => {
    setSearchQuery('');
    setViewingTask(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Get all prompt template directories with their tasks
  const promptDirectories: DirectoryWithTasks[] = useMemo(() => {
    return directories
      .filter(d => d.type === 'prompt')
      .map(dir => ({
        ...dir,
        expanded: true,
        tasks: dir.tasks.filter(t => t.status === 'completed' && t.result),
      }))
      .filter(dir => dir.tasks.length > 0); // Only show directories with templates
  }, [directories]);

  // Filter templates by search query
  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) {
      return promptDirectories;
    }

    return promptDirectories.map(dir => ({
      ...dir,
      tasks: dir.tasks.filter(task => {
        const nameMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
        const contentMatch = task.result?.toLowerCase().includes(searchQuery.toLowerCase());
        return nameMatch || contentMatch;
      }),
    })).filter(dir => dir.tasks.length > 0);
  }, [promptDirectories, searchQuery]);

  // Handle template selection
  const handleSelectTemplate = (template: Task) => {
    onConfirm(template);
    handleReset();
  };

  const handleClearSelection = () => {
    onConfirm(null);
    handleReset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Select Prompt Template to Import
          </Typography>
          <Chip 
            label={`${promptDirectories.length} directorie${promptDirectories.length !== 1 ? 's' : ''}`} 
            size="small"
            variant="outlined"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search templates by name or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <IconButton
                size="small"
                onClick={() => setSearchQuery('')}
                edge="end"
              >
                <ClearIcon />
              </IconButton>
            ) : null,
          }}
        />

        {/* Quick Actions */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearSelection}
          >
            Clear Selection
          </Button>
        </Box>

        {/* Directory Structure */}
        {filteredDirectories.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <AutoFixHighIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {searchQuery 
                ? `No templates found matching "${searchQuery}"`
                : 'No prompt templates available'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Create prompt templates in the Prompt Templates directory
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredDirectories.map((directory, dirIndex) => {
              return (
                <Box key={directory.id}>
                  {/* Directory Header */}
                  <Paper 
                    sx={{ 
                      p: 1.5, 
                      mb: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AutoFixHighIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ flexGrow: 1 }}>
                        {directory.name}
                      </Typography>
                      <Chip 
                        label={`${directory.tasks.length} template${directory.tasks.length !== 1 ? 's' : ''}`} 
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Paper>

                  {/* Templates List */}
                  <List sx={{ pl: 2 }}>
                    {directory.tasks.map((task) => {
                      return (
                        <ListItem
                          key={task.id}
                          disablePadding
                          sx={{ 
                            mb: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          <ListItemButton
                            dense
                            onClick={() => handleSelectTemplate(task)}
                            sx={{ 
                              '&:hover': { 
                                backgroundColor: 'action.hover',
                                borderLeft: 3,
                                borderColor: 'primary.main',
                              } 
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <AutoFixHighIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight="medium">
                                  {task.name}
                                </Typography>
                              }
                              secondary={
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {task.result?.substring(0, 100) || 'No content'}...
                                </Typography>
                              }
                            />
                            <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                              <Chip 
                                label={task.createdAt.toLocaleDateString()} 
                                size="small"
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingTask(task);
                                }}
                                title="View template content"
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>

                  {dirIndex < filteredDirectories.length - 1 && (
                    <Divider sx={{ my: 2 }} />
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Info Footer */}
        <Paper 
          sx={{ 
            mt: 2, 
            p: 2, 
            backgroundColor: 'info.light',
            color: 'info.contrastText',
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            Tip: Click on any template to import its content into the custom prompt field
          </Typography>
        </Paper>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>

      {/* View Task Dialog */}
      <Dialog 
        open={!!viewingTask} 
        onClose={() => setViewingTask(null)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {viewingTask?.name}
            </Typography>
            <Chip 
              label={viewingTask?.createdAt.toLocaleString()} 
              size="small"
              variant="outlined"
            />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
            {viewingTask?.result || 'No content available'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingTask(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
