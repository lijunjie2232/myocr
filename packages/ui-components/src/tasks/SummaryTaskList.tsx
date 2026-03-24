import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CancelIcon from '@mui/icons-material/Cancel';
import TextSnippetIcon from '@mui/icons-material/TextSnippet'; // For input text
import AssessmentIcon from '@mui/icons-material/Assessment'; // For summary result
import TextEditor from './TextEditor';
import SummaryTaskConfigDialog from './SummaryTaskConfigDialog';
import SummaryTaskDialog from './SummaryTaskDialog';
import { useAppContext } from '../context/AppContext';
import { summaryService } from '@myocr/ipc-client';
import type { Task } from '@myocr/types';

interface SummaryTaskListProps {
  directoryId: string;
}

export default function SummaryTaskList({ directoryId }: SummaryTaskListProps) {
  const { directories, deleteTask, updateTask, llmConfigs } = useAppContext();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [configuringTask, setConfiguringTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const directory = directories.find(d => d.id === directoryId);

  if (!directory) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">Directory not found</Typography>
      </Box>
    );
  }

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this summary task?')) {
      try {
        await deleteTask(directoryId, taskId);
      } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task. Please try again.');
      }
    }
  };

  const handleProcessTask = async (task: Task, action: 'do' | 'redo' | 'cancel') => {
    if (action === 'cancel' && task.status === 'processing') {
      await updateTask(directoryId, task.id, { status: 'pending' });
      return;
    }

    // Debug: Log the task configuration before processing
    console.log('Processing summary task:', {
      taskId: task.id,
      taskName: task.name,
      hasCustomPrompt: !!task.customPrompt,
      customPrompt: task.customPrompt,
      apiConfigId: task.apiConfigId,
      selectedModel: task.selectedModel,
      hasInputText: !!task.inputText,
      inputTextLength: task.inputText?.length || 0,
      inputTextPreview: task.inputText ? task.inputText.substring(0, 100) + '...' : 'N/A',
    });

    // Update task status to processing immediately
    await updateTask(directoryId, task.id, { status: 'processing' });
    
    try {
      // Get the text content from inputText field
      if (!task.inputText || task.inputText.trim() === '') {
        console.error('[SummaryTaskList] Task missing inputText:', {
          taskId: task.id,
          taskName: task.name,
          inputText: task.inputText,
        });
        throw new Error('No text content to summarize. Please check if the task was created correctly.');
      }

      // Call summary service through Electron IPC
      console.log('Calling summary service via IPC...');
      
      const result = await summaryService.processSummary({
        text: task.inputText,
        prompt: task.customPrompt,
        apiConfigId: task.apiConfigId || '',
        modelId: task.selectedModel || 'auto',
        memoryUsage: task.memoryUsage || 'none',
        memoryConfig: task.memoryConfig || { trigger: 2, keep: 1 },
        textSplitConfig: task.textSplitConfig || { chunkSize: 2000, chunkOverlap: 200 },
        temperature: task.temperature || 0.7,
        maxTokens: task.maxTokens || -1,
        resultFormat: task.resultFormat || 'plaintext',
      });
      
      // Update task with result
      await updateTask(directoryId, task.id, {
        result: result.summary,
        status: 'completed',
        metadata: result.metadata ? (result.metadata as Record<string, unknown>) : undefined,
      });
      
      console.log('✅ Summary task completed:', {
        taskId: task.id,
        status: 'completed',
        resultLength: result.summary.length,
        model: (result.metadata as any)?.model,
        provider: (result.metadata as any)?.provider,
      });
      
      console.log(`Summary created for ${task.name}`);
      console.log('Summary preview:', result.summary.substring(0, 200) + '...');
    } catch (err) {
      console.error(`Summary processing failed for ${task.name}:`, err);
      await updateTask(directoryId, task.id, {
        status: 'failed',
        errorMessage: (err as Error).message,
      });
    }
  };

  const handleViewInputText = (task: Task) => {
    // View original input text
    if (task.inputText) {
      setEditingTask({ ...task, result: task.inputText });
    }
  };

  const handleViewSummaryResult = (task: Task) => {
    // View summary result
    if (task.result) {
      setEditingTask(task);
    }
  };

  const handleEditConfig = (task: Task) => {
    setConfiguringTask(task);
  };

  const handleUpdateContent = async (taskId: string, newContent: string): Promise<void> => {
    setIsSaving(true);
    try {
      await updateTask(directoryId, taskId, { result: newContent });
    } catch (error) {
      console.error('Failed to update content:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Filter tasks by search query
  const filteredTasks = directory.tasks.filter(task => {
    if (!searchQuery.trim()) return true;
    const nameMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = task.result?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || contentMatch;
  });

  // Calculate statistics
  const stats = {
    total: directory.tasks.length,
    completed: directory.tasks.filter(t => t.status === 'completed').length,
    pending: directory.tasks.filter(t => t.status === 'pending').length,
    failed: directory.tasks.filter(t => t.status === 'failed').length,
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {directory.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Process and analyze text using LLM
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Task
        </Button>
      </Box>

      {/* Stats Chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={`Total: ${stats.total}`} size="small" />
        <Chip label={`Completed: ${stats.completed}`} size="small" color="success" />
        <Chip label={`Pending: ${stats.pending}`} size="small" color="warning" />
        <Chip label={`Failed: ${stats.failed}`} size="small" color="error" />
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search tasks by name or content..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
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
            No summary tasks yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first summary task to get started
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Supported input methods:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1 }}>
            <Chip label="Text Input" size="small" variant="outlined" />
            <Chip label="File Upload" size="small" variant="outlined" />
            <Chip label="OCR Tasks" size="small" variant="outlined" />
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Create First Task
          </Button>
        </Box>
      ) : filteredTasks.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No tasks found matching "{searchQuery}"
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSearchQuery('')}
            sx={{ mt: 2 }}
          >
            Clear Search
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 250 }}>Task Name</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Status</TableCell>
                <TableCell sx={{ minWidth: 200 }}>API / Model</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Created</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map((task) => (
                // Debug: Log task data for each rendered task
                console.log('=== Task Data Check ===', {
                  id: task.id,
                  name: task.name,
                  status: task.status,
                  hasInputText: !!task.inputText,
                  inputTextLength: task.inputText?.length,
                  hasResult: !!task.result,
                  resultLength: task.result?.length,
                  resultPreview: task.result?.substring(0, 50),
                  allKeys: Object.keys(task),
                }),
                <TableRow key={task.id} hover>
                    <TableCell sx={{ minWidth: 250 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <DescriptionIcon color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                          {task.name}
                        </Typography>
                      </Box>
                    </TableCell>
                  <TableCell>
                    <Chip
                      label={task.status.toUpperCase()}
                      size="small"
                      color={
                        task.status === 'completed' ? 'success' :
                        task.status === 'failed' ? 'error' :
                        'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {llmConfigs.find(c => c.id === task.apiConfigId)?.name || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {task.selectedModel || 'Auto'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {task.createdAt.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {/* Do/Redo/Cancel Buttons */}
                      {(task.status === 'pending' || task.status === 'failed') && (
                        <Tooltip title="Process Summary">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleProcessTask(task, 'do')}
                          >
                            <PlayArrowIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'completed' && (
                        <Tooltip title="Re-process">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handleProcessTask(task, 'redo')}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'processing' && (
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleProcessTask(task, 'cancel')}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* View Input Text Button - Always show if inputText exists */}
                      {(() => {
                        const shouldShow = !!task.inputText;
                        console.log('Input button visibility check:', {
                          taskId: task.id,
                          taskName: task.name,
                          status: task.status,
                          hasInputText: !!task.inputText,
                          inputTextLength: task.inputText?.length,
                          shouldShow,
                        });
                        return shouldShow && (
                          <Tooltip title="View Input Text">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewInputText(task)}
                            >
                              <TextSnippetIcon />
                            </IconButton>
                          </Tooltip>
                        );
                      })()}

                      {/* View Summary Result Button - Always show if result exists */}
                      {(() => {
                        const shouldShow = !!task.result;
                        console.log('Result button visibility check:', {
                          taskId: task.id,
                          taskName: task.name,
                          status: task.status,
                          hasResult: !!task.result,
                          resultLength: task.result?.length,
                          shouldShow,
                        });
                        return shouldShow && (
                          <Tooltip title="View Summary Result">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleViewSummaryResult(task)}
                            >
                              <AssessmentIcon />
                            </IconButton>
                          </Tooltip>
                        );
                      })()}

                      {/* Edit Configuration Button */}
                      <Tooltip title="Edit Configuration">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleEditConfig(task)}
                        >
                          <SettingsIcon />
                        </IconButton>
                      </Tooltip>

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
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <SummaryTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        directoryId={directoryId}
      />

      <SummaryTaskConfigDialog
        open={!!configuringTask}
        onClose={() => setConfiguringTask(null)}
        task={configuringTask}
        directoryId={directoryId}
      />

      <TextEditor
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        title={`Summary: ${editingTask?.name || ''}`}
        content={editingTask?.result || ''}
        subtitle={editingTask ? editingTask.createdAt.toLocaleString() : undefined}
        onSave={async (newContent: string) => {
          if (!editingTask) return;
          await handleUpdateContent(editingTask.id, newContent);
          setEditingTask(null);
        }}
        isSaving={isSaving}
      />
    </Box>
  );
}
