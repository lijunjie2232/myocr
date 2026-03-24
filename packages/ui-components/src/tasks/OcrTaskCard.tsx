import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  Box,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { Task } from '@myocr/types';

interface OcrTaskCardProps {
  task: Task;
  directoryId: string;
  onDelete: (taskId: string) => void;
  onExport: (task: Task) => void;
  onRetry?: (task: Task) => void;
}

export default function OcrTaskCard({ task, onDelete, onExport, onRetry }: Omit<OcrTaskCardProps, 'directoryId'>) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <HourglassEmptyIcon color="warning" />;
      case 'processing':
        return <CircularProgress size={24} />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending':
        return 'warning';
      case 'processing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: 'divider',
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      {task.status === 'processing' && <LinearProgress />}
      
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ mr: 1 }}>{getStatusIcon()}</Box>
          <Typography variant="h6" component="div" noWrap sx={{ flexGrow: 1 }}>
            {task.name}
          </Typography>
          <Chip
            label={task.status}
            size="small"
            color={getStatusColor() as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
          />
        </Box>

        {task.imageUrl && (
          <Box
            sx={{
              mt: 2,
              mb: 2,
              height: 150,
              overflow: 'hidden',
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            <img
              src={task.imageUrl}
              alt={task.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>
        )}

        {task.result ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {task.result.length > 100
              ? `${task.result.substring(0, 100)}...`
              : task.result}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {task.status === 'processing'
              ? 'Processing...'
              : 'No result yet'}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Created: {new Date(task.createdAt).toLocaleString()}
        </Typography>
      </CardContent>

      <CardActions>
        {task.status === 'failed' && onRetry && (
          <Button size="small" onClick={() => onRetry(task)}>
            Retry
          </Button>
        )}
        
        {task.result && task.status === 'completed' && (
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => onExport(task)}
          >
            Export
          </Button>
        )}
        
        <IconButton
          size="small"
          color="error"
          onClick={() => onDelete(task.id)}
          sx={{ ml: 'auto' }}
        >
          <DeleteIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
}
