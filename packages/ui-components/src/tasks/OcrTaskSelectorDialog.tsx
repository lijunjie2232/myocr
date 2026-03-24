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
  Checkbox,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAppContext } from '../context/AppContext';
import type { Task, Directory } from '@myocr/types';

interface OcrTaskSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTasks: Task[]) => void;
}

interface DirectoryWithTasks extends Directory {
  expanded: boolean;
  tasks: Task[];
}

export default function OcrTaskSelectorDialog({ open, onClose, onConfirm }: OcrTaskSelectorDialogProps) {
  const { directories } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Reset dialog state when closed
  const handleReset = () => {
    setSearchQuery('');
    setSelectedTaskIds([]);
    setViewingTask(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Get all OCR directories with their completed tasks
  const ocrDirectories: DirectoryWithTasks[] = useMemo(() => {
    return directories
      .filter(d => d.type === 'ocr')
      .map(dir => ({
        ...dir,
        expanded: true,
        tasks: dir.tasks.filter(t => t.status === 'completed' && t.result),
      }))
      .filter(dir => dir.tasks.length > 0); // Only show directories with completed tasks
  }, [directories]);

  // Filter tasks by search query
  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) {
      return ocrDirectories;
    }

    return ocrDirectories.map(dir => ({
      ...dir,
      tasks: dir.tasks.filter(task => {
        const nameMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
        const contentMatch = task.result?.toLowerCase().includes(searchQuery.toLowerCase());
        return nameMatch || contentMatch;
      }),
    })).filter(dir => dir.tasks.length > 0);
  }, [ocrDirectories, searchQuery]);

  // Calculate total selected count
  const selectedCount = selectedTaskIds.length;

  // Get all selected tasks for confirmation
  const handleConfirm = () => {
    const allTasks = ocrDirectories.flatMap(d => d.tasks);
    const selectedTasks = allTasks.filter(t => selectedTaskIds.includes(t.id));
    onConfirm(selectedTasks);
    handleReset(); // Reset state after confirmation
  };

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const handleSelectAllInDirectory = (directory: DirectoryWithTasks, checked: boolean) => {
    if (checked) {
      // Select all tasks in this directory
      setSelectedTaskIds(prev => {
        const newIds = directory.tasks
          .map(t => t.id)
          .filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    } else {
      // Deselect all tasks in this directory
      setSelectedTaskIds(prev => 
        prev.filter(id => !directory.tasks.some(t => t.id === id))
      );
    }
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleSelectAll = () => {
    const allTaskIds = ocrDirectories.flatMap(d => d.tasks.map(t => t.id));
    setSelectedTaskIds(allTaskIds);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Select OCR Tasks to Import
          </Typography>
          <Chip 
            label={`${selectedCount} selected`} 
            size="small"
            color={selectedCount > 0 ? 'primary' : 'default'}
          />
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search tasks by name or content..."
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
            onClick={handleSelectAll}
            disabled={ocrDirectories.length === 0}
          >
            Select All
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearSelection}
            disabled={selectedCount === 0}
          >
            Clear Selection
          </Button>
        </Box>

        {/* Directory Structure */}
        {filteredDirectories.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery 
                ? `No tasks found matching "${searchQuery}"`
                : 'No completed OCR tasks available'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredDirectories.map((directory, dirIndex) => {
              const allSelected = directory.tasks.every(t => selectedTaskIds.includes(t.id));
              const someSelected = directory.tasks.some(t => selectedTaskIds.includes(t.id));

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
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={(e) => handleSelectAllInDirectory(directory, e.target.checked)}
                        size="small"
                      />
                      <FolderIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ flexGrow: 1 }}>
                        {directory.name}
                      </Typography>
                      <Chip 
                        label={`${directory.tasks.length} tasks`} 
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Paper>

                  {/* Tasks List */}
                  <List sx={{ pl: 2 }}>
                    {directory.tasks.map((task) => {
                      const isSelected = selectedTaskIds.includes(task.id);
                      
                      return (
                        <ListItem
                          key={task.id}
                          disablePadding
                          sx={{ 
                            mb: 0.5,
                            backgroundColor: isSelected ? 'action.selected' : 'transparent',
                            borderRadius: 1,
                          }}
                        >
                          <ListItemButton
                            dense
                            onClick={() => handleToggleTask(task.id)}
                            sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <Checkbox
                                edge="start"
                                checked={isSelected}
                                tabIndex={-1}
                                disableRipple
                                size="small"
                              />
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <DescriptionIcon fontSize="small" color="primary" />
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
                                title="View task content"
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

        {/* Summary Footer */}
        {selectedCount > 0 && (
          <Paper 
            sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
            }}
          >
            <Typography variant="body2" fontWeight="bold">
              {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
            </Typography>
            <Typography variant="caption">
              Content from all selected tasks will be concatenated and imported
            </Typography>
          </Paper>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained"
          disabled={selectedCount === 0}
        >
          Import {selectedCount > 0 ? `(${selectedCount})` : ''}
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
