import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DirectoryCard from './DirectoryCard';
import InputDialog from '../components/InputDialog';
import { useAppContext } from '../context/AppContext';
import type { TaskType } from '@myocr/types';

interface DirectoryListProps {
  type: TaskType;
}

export default function DirectoryList({ type }: DirectoryListProps) {
  const {
    directories,
    activeDirectoryId,
    setActiveDirectory,
    updateDirectory,
    deleteDirectory,
    createDirectory,
  } = useAppContext();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Filter directories by type
  const typeDirectories = directories.filter(d => d.type === type);

  const handleCreateDirectory = async (name: string, description?: string) => {
    await createDirectory(name, type, description);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <h2>{type === 'ocr' ? 'OCR' : type === 'summary' ? 'Summary' : 'Prompt Templates'} Directories</h2>
          <Typography variant="caption" color="text.secondary">
            Managing {type === 'prompt' ? 'Prompt Templates' : type.toUpperCase()} directories
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create {type === 'ocr' ? 'OCR' : type === 'summary' ? 'Summary' : 'Prompt Template'} Directory
        </Button>
      </Box>

      <InputDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onConfirm={handleCreateDirectory}
        title={`Create ${type === 'ocr' ? 'OCR' : type === 'summary' ? 'Summary' : 'Prompt Template'} Directory`}
        label="Directory Name"
        placeholder={`Enter ${type} directory name`}
        descriptionLabel="Description"
        validate={(value) => {
          if (!value.trim()) {
            return 'Please enter a directory name';
          }
          return null;
        }}
      />

      {typeDirectories.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            backgroundColor: 'action.hover',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No {type === 'ocr' ? 'OCR' : type === 'summary' ? 'Summary' : 'Prompt Template'} directories yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click the button above to create your first {type === 'prompt' ? 'prompt template' : type} directory
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {typeDirectories.map((directory) => (
            <DirectoryCard
              key={directory.id}
              id={directory.id}
              name={directory.name}
              taskCount={directory.tasks.length}
              isSelected={activeDirectoryId === directory.id}
              onSelect={setActiveDirectory}
              onEdit={updateDirectory}
              onDelete={deleteDirectory}
              type={directory.type}
              description={directory.description}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
