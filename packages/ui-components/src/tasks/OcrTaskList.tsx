import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Checkbox,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CancelIcon from '@mui/icons-material/Cancel';
import ScienceIcon from '@mui/icons-material/Science';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewListIcon from '@mui/icons-material/ViewList';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ClearIcon from '@mui/icons-material/Clear';
import SettingsIcon from '@mui/icons-material/Settings';
import OcrImageUploadDialog from './OcrImageUploadDialog';
import OcrTaskConfigDialog from './OcrTaskConfigDialog';
import { useAppContext } from '../context/AppContext';
import { ocrService } from '@myocr/ipc-client';
import type { Task } from '@myocr/types';
import { downloadTextFile } from '../utils';

interface TaskListProps {
  directoryId: string;
}

export default function TaskList({ directoryId }: TaskListProps) {
  const { directories, deleteTask, exportTaskResult, updateTask, llmConfigs, exportTaskToSummary } = useAppContext();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set());
  
  // Batch action menu state
  const [batchMenuAnchor, setBatchMenuAnchor] = useState<null | HTMLElement>(null);
  const [batchApiModelDialogOpen, setBatchApiModelDialogOpen] = useState(false);
  const [batchApiId, setBatchApiId] = useState<string>('');
  const [batchModelId, setBatchModelId] = useState<string>('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
  // Task config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configuringTask, setConfiguringTask] = useState<Task | null>(null);
  
  // Result viewer state
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<{start: number, end: number}[]>([]);
  const textContentRef = useRef<HTMLDivElement>(null);
  
  const directory = directories.find(d => d.id === directoryId);
  
  if (!directory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">Directory not found</Typography>
      </Box>
    );
  }

  // Calculate statistics
  const stats = useMemo(() => ({
    total: directory.tasks.length,
    pending: directory.tasks.filter(t => t.status === 'pending').length,
    processing: directory.tasks.filter(t => t.status === 'processing').length,
    completed: directory.tasks.filter(t => t.status === 'completed').length,
    failed: directory.tasks.filter(t => t.status === 'failed').length,
  }), [directory.tasks]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTasks(new Set(directory.tasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(directoryId, taskId);
      setSelectedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleExportTask = (task: Task) => {
    const content = exportTaskResult(task.id);
    downloadTextFile(content, `${task.name}-result.txt`);
  };

  const handleExportToSummary = async (task: Task) => {
    await exportTaskToSummary(task.id);
    alert('Task exported to Summary directory!');
  };

  const handleBatchExport = () => {
    const selectedTasksArray = directory.tasks.filter(t => selectedTasks.has(t.id));
    const content = selectedTasksArray.map(task => {
      const result = exportTaskResult(task.id);
      return `=== ${task.name} ===\n${result}\n`;
    }).join('\n');
    downloadTextFile(content, `${directory.name}-batch-export.txt`);
  };

  // Batch Actions
  const handleBatchMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setBatchMenuAnchor(event.currentTarget);
  };

  const handleBatchMenuClose = () => {
    setBatchMenuAnchor(null);
  };

  const handleBatchDoRedoOCR = async () => {
    handleBatchMenuClose();
    setIsBatchProcessing(true);
    
    const tasksToProcess = directory.tasks.filter(
      t => selectedTasks.has(t.id) && (t.status === 'pending' || t.status === 'failed' || t.status === 'completed')
    );

    for (const task of tasksToProcess) {
      try {
        console.log('[OcrTaskList] Processing task:', {
          taskId: task.id,
          taskName: task.name,
          imageUrlPreview: task.imageUrl?.substring(0, 50) + '...'
        });
        
        // Validate image URL
        if (!task.imageUrl) {
          throw new Error('Task has no image');
        }
        
        console.log('[OcrTaskList] Batch OCR - Task configuration:', {
          taskId: task.id,
          apiConfigId: task.apiConfigId,
          selectedModel: task.selectedModel,
          temperature: task.temperature,
          maxTokens: task.maxTokens,
          customPrompt: task.customPrompt,
        });
        
        // Fetch image and convert to blob
        const response = await fetch(task.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const file = new File([blob], task.name, { type: blob.type });
        
        console.log('[OcrTaskList] Batch OCR - Calling ocrService.processImage with:', {
          image: file.name,
          apiConfigId: task.apiConfigId || undefined,
          modelId: task.selectedModel || undefined,
          temperature: task.temperature,
          maxTokens: task.maxTokens,
          prompt: task.customPrompt || undefined,
        });
        
        // Call OCR service through Electron IPC
        const ocrResult = await ocrService.processImage({
          image: file,
          apiConfigId: task.apiConfigId || undefined,
          modelId: task.selectedModel || undefined,
          temperature: task.temperature,
          maxTokens: task.maxTokens,
          prompt: task.customPrompt || undefined,
        });
        
        // Update task with result
        await updateTask(directoryId, task.id, {
          result: ocrResult.text,
          status: 'completed',
        });
        
        console.log('[OcrTaskList] Batch OCR completed successfully for task:', task.id);
      } catch (err) {
        console.error(`Batch OCR failed for ${task.name}:`, err);
        await updateTask(directoryId, task.id, {
          status: 'failed',
          errorMessage: (err as Error).message,
        });
      }
    }

    setIsBatchProcessing(false);
  };

  const handleBatchCancel = async () => {
    handleBatchMenuClose();
    
    const tasksToCancel = directory.tasks.filter(
      t => selectedTasks.has(t.id) && t.status === 'processing'
    );

    for (const task of tasksToCancel) {
      await updateTask(directoryId, task.id, { status: 'pending' });
    }
  };

  const handleBatchDelete = async () => {
    handleBatchMenuClose();
    
    if (confirm(`Are you sure you want to delete ${selectedTasks.size} selected task(s)?`)) {
      for (const taskId of selectedTasks) {
        await deleteTask(directoryId, taskId);
      }
      setSelectedTasks(new Set());
    }
  };

  const handleBatchApiModelOpen = () => {
    handleBatchMenuClose();
    setBatchApiId('');
    setBatchModelId('');
    setBatchApiModelDialogOpen(true);
  };

  const handleBatchApiModelApply = async () => {
    if (!batchApiId) {
      alert('Please select an API configuration');
      return;
    }

    setBatchApiModelDialogOpen(false);
    setIsBatchProcessing(true);

    // Update all selected tasks with new API/model
    for (const taskId of selectedTasks) {
      await updateTask(directoryId, taskId, {
        apiConfigId: batchApiId,
        selectedModel: batchModelId || undefined,
      });
    }

    setIsBatchProcessing(false);
    setBatchApiId('');
    setBatchModelId('');
  };

  // View result handlers
  const handleViewResult = (task: Task) => {
    setViewingTask(task);
    setResultDialogOpen(true);
  };

  const handleCloseResultDialog = () => {
    setResultDialogOpen(false);
    setTimeout(() => setViewingTask(null), 300); // Clear after animation
  };

  // Get all completed tasks with results
  const completedTasks = useMemo(() => {
    return directory?.tasks.filter(t => t.status === 'completed' && t.result) || [];
  }, [directory]);

  // Switch to another task in viewer
  const handleSwitchTask = (task: Task) => {
    setViewingTask(task);
  };

  // Search functionality
  const matchRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  useEffect(() => {
    if (!searchQuery || !viewingTask?.result) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const text = viewingTask.result;
    const newMatches: {start: number, end: number}[] = [];
    
    try {
      let regex: RegExp;
      if (useRegex) {
        regex = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
      } else {
        // Escape special regex characters for plain text search
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
      }
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        newMatches.push({ start: match.index, end: match.index + match[0].length });
      }
      
      setMatches(newMatches);
      setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
      matchRefs.current = new Array(newMatches.length).fill(null);
    } catch (e) {
      // Invalid regex, clear matches
      setMatches([]);
      setCurrentMatchIndex(-1);
      matchRefs.current = [];
    }
  }, [searchQuery, caseSensitive, useRegex, viewingTask?.result]);

  const handleFindNext = () => {
    if (matches.length === 0 || currentMatchIndex === -1) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    setTimeout(() => scrollToMatch(nextIndex), 50);
  };

  const handleFindPrevious = () => {
    if (matches.length === 0 || currentMatchIndex === -1) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    setTimeout(() => scrollToMatch(prevIndex), 50);
  };

  const handleOCRAction = async (task: Task, action: 'do' | 'redo' | 'cancel') => {
    if (action === 'cancel' && task.status === 'processing') {
      await updateTask(directoryId, task.id, { status: 'pending' });
      setProcessingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
      return;
    }

    // Validate image URL before processing
    if (!task.imageUrl) {
      console.error('[OcrTaskList] Task has no image URL:', task.id);
      await updateTask(directoryId, task.id, {
        status: 'failed',
        errorMessage: 'Task has no image',
      });
      return;
    }

    // Update task status to processing immediately
    await updateTask(directoryId, task.id, { status: 'processing' });
    setProcessingTasks(prev => new Set(prev).add(task.id));
    
    try {
      console.log('[OcrTaskList] handleOCRAction processing task:', {
        taskId: task.id,
        taskName: task.name,
        imageUrlPreview: task.imageUrl?.substring(0, 50) + '...'
      });
      
      // Get image blob from base64 URL
      const response = await fetch(task.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[OcrTaskList] Fetched image blob:', {
        type: blob.type,
        size: blob.size,
      });
      
      const file = new File([blob], task.name, { type: blob.type });

      // Debug: Log task configuration before calling OCR service
      console.log('[OcrTaskList] Task configuration:', {
        taskId: task.id,
        apiConfigId: task.apiConfigId,
        selectedModel: task.selectedModel,
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        customPrompt: task.customPrompt,
      });

      // Call OCR service through Electron IPC
      console.log('[OcrTaskList] Calling ocrService.processImage with:', {
        image: file.name,
        apiConfigId: task.apiConfigId || undefined,
        modelId: task.selectedModel || undefined,
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        prompt: task.customPrompt || undefined,
      });

      const ocrResult = await ocrService.processImage({
        image: file,
        apiConfigId: task.apiConfigId || undefined,
        modelId: task.selectedModel || undefined,
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        prompt: task.customPrompt || undefined,
      });
      
      console.log('[OcrTaskList] OCR result received:', {
        taskId: task.id,
        resultLength: ocrResult.text.length,
        resultPreview: ocrResult.text.substring(0, 100) + '...',
      });
      
      // Update task with result
      console.log('[OcrTaskList] Updating task in database:', {
        taskId: task.id,
        status: 'completed',
        resultLength: ocrResult.text.length,
      });
      
      await updateTask(directoryId, task.id, {
        result: ocrResult.text,
        status: 'completed',
      });
      
      console.log('[OcrTaskList] Task update completed for:', task.id);
      
      console.log('[OcrTaskList] OCR completed successfully for task:', task.id);
    } catch (err) {
      console.error(`OCR failed for ${task.name}:`, err);
      await updateTask(directoryId, task.id, {
        status: 'failed',
        errorMessage: (err as Error).message,
      });
    } finally {
      setProcessingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  const scrollToMatch = (index: number) => {
    const element = matchRefs.current[index];
    if (!element) return;
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
  };

  // Render text with highlighted matches
  const renderHighlightedText = () => {
    if (!viewingTask?.result) {
      return 'No result available';
    }

    // No search or no matches - render plain text with line breaks preserved
    if (!searchQuery || matches.length === 0) {
      return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {viewingTask.result}
        </span>
      );
    }

    // Has matches - render with highlights
    const parts = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      // Text before match
      if (match.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`} style={{ whiteSpace: 'pre-wrap' }}>
            {viewingTask.result!.substring(lastIndex, match.start)}
          </span>
        );
      }
      
      // Matched text with highlight
      const isCurrentMatch = index === currentMatchIndex;
      parts.push(
        <span
          key={`match-${index}`}
          ref={(el) => {
            if (el) matchRefs.current[index] = el;
          }}
          tabIndex={-1}
          style={{
            backgroundColor: isCurrentMatch ? '#ff9800' : '#ffc107',
            color: isCurrentMatch ? '#ffffff' : '#000000',
            padding: '2px 4px',
            borderRadius: '3px',
            border: isCurrentMatch ? '2px solid #f57c00' : '2px solid #ffa000',
            fontWeight: isCurrentMatch ? 'bold' : 'normal',
            transition: 'all 0.2s ease',
            display: 'inline-block',
            whiteSpace: 'pre-wrap',
          }}
        >
          {viewingTask.result!.substring(match.start, match.end)}
        </span>
      );
      
      lastIndex = match.end;
    });

    // Remaining text after last match
    if (lastIndex < viewingTask.result.length) {
      parts.push(
        <span key="text-end" style={{ whiteSpace: 'pre-wrap' }}>
          {viewingTask.result.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <Box>
      {/* Header with stats */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {directory.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip label={`Total: ${stats.total}`} size="small" />
            <Chip label={`Pending: ${stats.pending}`} size="small" color="warning" />
            <Chip label={`Processing: ${stats.processing}`} size="small" color="info" />
            <Chip label={`Completed: ${stats.completed}`} size="small" color="success" />
            <Chip label={`Failed: ${stats.failed}`} size="small" color="error" />
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Batch Actions Menu */}
          {selectedTasks.size > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleBatchExport}
                disabled={isBatchProcessing}
              >
                Export Selected ({selectedTasks.size})
              </Button>
              <Button
                variant="contained"
                endIcon={<MoreVertIcon />}
                onClick={handleBatchMenuOpen}
                disabled={isBatchProcessing}
              >
                Actions
              </Button>
              <Menu
                anchorEl={batchMenuAnchor}
                open={Boolean(batchMenuAnchor)}
                onClose={handleBatchMenuClose}
              >
                <MenuItem onClick={handleBatchDoRedoOCR}>
                  <PlayArrowIcon sx={{ mr: 1 }} fontSize="small" />
                  Do/Re-do OCR
                </MenuItem>
                <MenuItem onClick={handleBatchCancel}>
                  <CancelIcon sx={{ mr: 1 }} fontSize="small" />
                  Cancel OCR
                </MenuItem>
                <MenuItem onClick={handleBatchDelete}>
                  <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
                  Remove
                </MenuItem>
                <MenuItem onClick={handleBatchApiModelOpen}>
                  <ScienceIcon sx={{ mr: 1 }} fontSize="small" />
                  Use New API & Model
                </MenuItem>
              </Menu>
            </>
          )}
          {!selectedTasks.size && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleBatchExport}
              disabled
            >
              Export Selected
            </Button>
          )}
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Image
          </Button>
        </Box>
      </Box>

      {directory.tasks.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            backgroundColor: 'action.hover',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No tasks yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload an image to start OCR
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Upload First Image
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    onChange={handleSelectAll}
                    checked={selectedTasks.size === directory.tasks.length && directory.tasks.length > 0}
                    indeterminate={selectedTasks.size > 0 && selectedTasks.size < directory.tasks.length}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 200 }}>Image</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Status</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Progress</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {directory.tasks.map((task) => {
                const isProcessing = processingTasks.has(task.id);
                const canDoOCR = task.status === 'pending' || task.status === 'failed';
                const canRedoOCR = task.status === 'completed';
                const canCancel = task.status === 'processing';

                return (
                  <TableRow key={task.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onChange={() => handleSelectTask(task.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <img
                          src={task.imageUrl}
                          alt={task.name}
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 4,
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {task.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {task.createdAt.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={task.status.toUpperCase()}
                        size="small"
                        color={
                          task.status === 'completed' ? 'success' :
                          task.status === 'failed' ? 'error' :
                          task.status === 'processing' ? 'info' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {(isProcessing || task.status === 'processing') ? (
                        <LinearProgress sx={{ borderRadius: 2 }} />
                      ) : task.status === 'completed' ? (
                        <Chip label="✓ Done" size="small" color="success" variant="outlined" />
                      ) : task.status === 'failed' ? (
                        <Typography variant="caption" color="error">
                          {task.errorMessage || 'Failed'}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Waiting
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {/* Do/Redo/Cancel Button */}
                        {canDoOCR && (
                          <Tooltip title="Do OCR">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOCRAction(task, 'do')}
                            >
                              <PlayArrowIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canRedoOCR && (
                          <Tooltip title="Re-OCR">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handleOCRAction(task, 'redo')}
                            >
                              <RefreshIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canCancel && (
                          <Tooltip title="Cancel">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => handleOCRAction(task, 'cancel')}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* View Result Button */}
                        {task.status === 'completed' && task.result && (
                          <Tooltip title="View Result">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewResult(task)}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Export to Summary Button */}
                        {task.status === 'completed' && task.result && (
                          <Tooltip title="Export to Summary">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => handleExportToSummary(task)}
                            >
                              <ScienceIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Export Button */}
                        {task.status === 'completed' && (
                          <Tooltip title="Export Result">
                            <IconButton
                              size="small"
                              color="default"
                              onClick={() => handleExportTask(task)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Delete Button */}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="default"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>

                        {/* Settings Button */}
                        <Tooltip title="Configure Task">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setConfiguringTask(task);
                              setConfigDialogOpen(true);
                            }}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <OcrImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        directoryId={directoryId}
      />

      {/* Batch API/Model Selection Dialog */}
      <Dialog open={batchApiModelDialogOpen} onClose={() => setBatchApiModelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply New API & Model to Selected Tasks</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will update {selectedTasks.size} selected task(s) with the new configuration.
          </Typography>

          {/* API Selection */}
          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel>API Configuration</InputLabel>
            <Select
              value={batchApiId}
              label="API Configuration"
              onChange={(e) => setBatchApiId(e.target.value)}
              startAdornment={<ScienceIcon sx={{ mr: 1, color: 'text.secondary' }} />}
            >
              {llmConfigs.map((config) => (
                <MenuItem key={config.id} value={config.id}>
                  {config.name} ({config.provider})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Model Selection */}
          {batchApiId && (() => {
            const config = llmConfigs.find(c => c.id === batchApiId);
            return config && config.models && config.models.length > 0 ? (
              <FormControl fullWidth>
                <InputLabel>Model (Optional)</InputLabel>
                <Select
                  value={batchModelId}
                  label="Model (Optional)"
                  onChange={(e) => setBatchModelId(e.target.value)}
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  {config.models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {config.name}: {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null;
          })()}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Note: This will only update the API/model configuration. You'll need to run OCR again to use the new settings.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchApiModelDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleBatchApiModelApply} 
            variant="contained"
            disabled={!batchApiId || isBatchProcessing}
          >
            Apply to {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Result Viewer Dialog */}
      <Dialog 
        open={resultDialogOpen} 
        onClose={handleCloseResultDialog} 
        maxWidth="md" 
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                sx={{ 
                  transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ViewListIcon />
              </IconButton>
              <Typography variant="h6" component="span">
                OCR Result - {viewingTask?.name}
              </Typography>
              {viewingTask && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  API: {llmConfigs.find(c => c.id === viewingTask.apiConfigId)?.name || 'N/A'} | 
                  Model: {viewingTask.selectedModel || 'Auto'}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Copy to Clipboard">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (viewingTask?.result) {
                      navigator.clipboard.writeText(viewingTask.result);
                    }
                  }}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  if (viewingTask) {
                    handleExportTask(viewingTask);
                  }
                }}
              >
                Export
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar Drawer */}
          <Box
            sx={{
              width: sidebarOpen ? 280 : 0,
              flexShrink: 0,
              transition: 'width 0.3s ease',
              overflow: 'hidden',
            }}
          >
            <Drawer
              variant="persistent"
              anchor="left"
              open={sidebarOpen}
              sx={{
                '& .MuiDrawer-paper': {
                  width: 280,
                  position: 'relative',
                  borderRight: '1px solid divider',
                  boxShadow: 'none',
                  backgroundColor: '#fafafa',
                },
              }}
              PaperProps={{
                sx: {
                  width: 280,
                },
              }}
            >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Completed Tasks ({completedTasks.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click to switch
                </Typography>
              </Box>
            </Box>
            
            <List sx={{ p: 0, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              {completedTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={viewingTask?.id === task.id}
                      onClick={() => handleSwitchTask(task)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: viewingTask?.id === task.id ? 'action.selectedHover' : 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <VisibilityIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.name}
                        secondary={
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {task.result?.substring(0, 50) || 'No content'}...
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < completedTasks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            </Drawer>
          </Box>

          {/* Main Content Area */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: '#f5f5f5',
            }}
          >
            {/* Text Content with Line Numbers */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                overflow: 'auto',
              }}
            >
              {/* Line Numbers */}
              <Box
                sx={{
                  p: 3,
                  backgroundColor: '#fafafa',
                  borderRight: '1px solid #e0e0e0',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: '#9e9e9e',
                  textAlign: 'right',
                  userSelect: 'none',
                  minWidth: '50px',
                }}
              >
                {viewingTask?.result
                  ? viewingTask.result.split('\n').map((_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))
                  : null}
              </Box>
              
              {/* Text Content */}
              <Box
                ref={textContentRef}
                sx={{
                  flex: 1,
                  p: 3,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  overflow: 'visible',
                }}
              >
                {renderHighlightedText()}
              </Box>
            </Box>
            
            {/* Search Bar - Bottom Left */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                backgroundColor: 'white',
                borderTop: '1px solid #e0e0e0',
                boxShadow: '0 -1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <TextField
                size="small"
                placeholder="Search in text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFindNext();
                  } else if (e.key === 'F3') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handleFindPrevious();
                    } else {
                      handleFindNext();
                    }
                  }
                }}
                sx={{
                  width: 300,
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.875rem',
                  },
                }}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: searchQuery ? (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSearchQuery('');
                        setMatches([]);
                        setCurrentMatchIndex(-1);
                      }}
                      edge="end"
                    >
                      <ClearIcon />
                    </IconButton>
                  ) : null,
                }}
              />
              
              <Tooltip title="Previous Match (Shift+F3)">
                <IconButton
                  size="small"
                  onClick={handleFindPrevious}
                  disabled={matches.length === 0}
                  color={currentMatchIndex !== -1 ? 'primary' : 'default'}
                >
                  <KeyboardArrowUpIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Next Match (F3)">
                <IconButton
                  size="small"
                  onClick={handleFindNext}
                  disabled={matches.length === 0}
                  color={currentMatchIndex !== -1 ? 'primary' : 'default'}
                >
                  <KeyboardArrowDownIcon />
                </IconButton>
              </Tooltip>
              
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 120,
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  value={currentMatchIndex !== -1 ? currentMatchIndex + 1 : ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= matches.length) {
                      setCurrentMatchIndex(value - 1);
                      setTimeout(() => scrollToMatch(value - 1), 50);
                    }
                  }}
                  inputProps={{
                    min: 1,
                    max: matches.length,
                    style: { textAlign: 'center', width: '50px' },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                  disabled={matches.length === 0}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  of {matches.length}
                </Typography>
              </Box>
              
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                  />
                }
                label={<Typography variant="caption">Case</Typography>}
                sx={{ ml: 1 }}
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                  />
                }
                label={<Typography variant="caption">Regex</Typography>}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResultDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* OCR Task Config Dialog */}
      <OcrTaskConfigDialog
        open={configDialogOpen}
        onClose={() => {
          setConfigDialogOpen(false);
          setConfiguringTask(null);
        }}
        task={configuringTask}
        directoryId={directoryId}
      />
    </Box>
  );
}
