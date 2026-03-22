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
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import PromptTemplateDialog from './PromptTemplateDialog';
import TextEditor from './TextEditor';
import InputDialog from '../components/InputDialog';
import { useAppContext } from '../context/AppContext';
import type { Task } from '@myocr/types';

interface PromptTaskListProps {
  directoryId: string;
}

export default function PromptTaskList({ directoryId }: PromptTaskListProps) {
  const { directories, deleteTask, updateTask } = useAppContext();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editNameTask, setEditNameTask] = useState<Task | null>(null);
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
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTask(directoryId, taskId);
    }
  };

  const handlePreview = (task: Task) => {
    if (task.result) {
      setEditingTask(task); // Directly open editor in view mode
    }
  };

  const handleEditName = async (task: Task, newName: string, newDescription?: string) => {
    const updates: any = { name: newName };
    if (newDescription !== undefined) {
      updates.description = newDescription;
    }
    await updateTask(directoryId, task.id, updates);
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
            Manage your prompt templates
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setTemplateDialogOpen(true)}
        >
          Create Template
        </Button>
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
            No templates yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first template to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTemplateDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Create First Template
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 300 }}>Template Name</TableCell>
                <TableCell sx={{ minWidth: 250 }}>Description</TableCell>
                <TableCell>Preview</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Created</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {directory.tasks.map((task) => (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <DescriptionIcon color="primary" />
                      <Typography variant="body2" fontWeight="medium">
                        {task.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {(task as any).description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {task.result?.substring(0, 150) || 'No content'}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {task.createdAt.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Preview">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handlePreview(task)}
                        >
                          <DescriptionIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Edit Name">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => setEditNameTask(task)}
                        >
                          <DriveFileRenameOutlineIcon />
                        </IconButton>
                      </Tooltip>

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

      <PromptTemplateDialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        directoryId={directoryId}
      />

      <TextEditor
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        title={editingTask ? `Template: ${editingTask.name}` : ''}
        content={editingTask?.result || ''}
        onSave={async (newContent: string) => {
          if (!editingTask) return;
          setIsSaving(true);
          try {
            await updateTask(directoryId, editingTask.id, { result: newContent });
            setEditingTask(null);
          } catch (error) {
            console.error('Failed to save content:', error);
            throw error;
          } finally {
            setIsSaving(false);
          }
        }}
        isSaving={isSaving}
      />

      <InputDialog
        open={!!editNameTask}
        onClose={() => setEditNameTask(null)}
        onConfirm={(newName, newDescription) => {
          if (editNameTask) {
            handleEditName(editNameTask, newName, newDescription);
            setEditNameTask(null);
          }
        }}
        title="Edit Template"
        label="Template Name"
        defaultValue={editNameTask?.name || ''}
        descriptionLabel="Description"
        defaultDescription={(editNameTask as any)?.description || ''}
        validate={(value) => {
          if (!value.trim()) {
            return 'Please enter a template name';
          }
          return null;
        }}
      />
    </Box>
  );
}
