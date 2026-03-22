import { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  Box,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import InputDialog from '../components/InputDialog';

interface DirectoryCardProps {
  id: string;
  name: string;
  taskCount: number;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string, newName: string, newDescription?: string) => void;
  onDelete: (id: string) => void;
  type?: 'ocr' | 'summary' | 'prompt'; // Add type to customize label
  description?: string; // Add description prop
}

export default function DirectoryCard({
  id,
  name,
  taskCount,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  type = 'ocr',
  description,
}: DirectoryCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete directory "${name}"?`)) {
      onDelete(id);
    }
  };

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: isSelected ? 2 : 1,
          borderColor: isSelected ? 'primary.main' : 'divider',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 3,
          },
        }}
        onClick={() => onSelect(id)}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <FolderIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" noWrap>
              {name}
            </Typography>
          </Box>
          <Chip
            label={`${taskCount} ${type === 'prompt' ? (taskCount === 1 ? 'template' : 'templates') : (taskCount === 1 ? 'task' : 'tasks')}`}
            size="small"
            color={taskCount > 0 ? 'primary' : 'default'}
          />
          {description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mt: 1,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </Typography>
          )}
        </CardContent>
        <CardActions>
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={(e) => {
              e.stopPropagation();
              setEditDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            <DeleteIcon />
          </IconButton>
        </CardActions>
      </Card>

      <InputDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onConfirm={(newName, newDescription) => onEdit(id, newName, newDescription)}
        title="Edit Directory"
        label="Directory Name"
        defaultValue={name}
        descriptionLabel="Description"
        defaultDescription={description}
        validate={(value) => {
          if (!value.trim()) {
            return 'Please enter a directory name';
          }
          return null;
        }}
      />
    </>
  );
}
