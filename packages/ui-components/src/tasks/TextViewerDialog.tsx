import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface TextViewerDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export default function TextViewerDialog({ open, onClose, title, content }: TextViewerDialogProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      fullScreen
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              <ContentCopyIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={onClose}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            p: 2,
            backgroundColor: 'grey.50',
            borderRadius: 1,
            minHeight: '400px',
          }}
        >
          <Typography
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              m: 0,
            }}
          >
            {content}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
