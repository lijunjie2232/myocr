import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Box,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import TextEditor from './TextEditor';
import InputDialog from '../components/InputDialog';
import { useState } from 'react';

interface PromptTaskCardProps {
  id: string;
  name: string;
  promptContent?: string;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onUpdateContent?: (id: string, newContent: string) => Promise<void>; // New prop
}

export default function PromptTaskCard({
  id,
  name,
  promptContent,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onUpdateContent,
}: PromptTaskCardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete template "${name}"?`)) {
      onDelete(id);
    }
  };

  const handlePreview = () => {
    if (promptContent) {
      setEditorOpen(true); // Directly open editor in view mode
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
            <DescriptionIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" noWrap>
              {name}
            </Typography>
          </Box>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mt: 1,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
            }}
          >
            {promptContent || 'No content'}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            size="small"
            startIcon={<DescriptionIcon />}
            onClick={(e) => {
              e.stopPropagation();
              handlePreview();
            }}
          >
            Preview
          </Button>
          <Button
            size="small"
            startIcon={<DriveFileRenameOutlineIcon />}
            onClick={(e) => {
              e.stopPropagation();
              setEditDialogOpen(true);
            }}
          >
            Name
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
      
      {editorOpen && (
        <TextEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title={`Template: ${name}`}
          content={promptContent || ''}
          onSave={async (newContent: string) => {
            if (!onUpdateContent) return;
            setIsSaving(true);
            try {
              await onUpdateContent(id, newContent);
              setEditorOpen(false);
            } catch (error) {
              console.error('Failed to save content:', error);
              throw error;
            } finally {
              setIsSaving(false);
            }
          }}
          isSaving={isSaving}
        />
      )}

      <InputDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onConfirm={(newName) => onEdit(id, newName)}
        title="Edit Template Name"
        label="Template Name"
        defaultValue={name}
        validate={(value) => {
          if (!value.trim()) {
            return 'Please enter a template name';
          }
          return null;
        }}
      />
    </>
  );
}
