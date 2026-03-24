import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
} from '@mui/material';

interface InputDialogProps {
  open: boolean;
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  onClose: () => void;
  onConfirm: (value: string, description?: string) => void;
  validate?: (value: string) => string | null; // Returns error message or null
  descriptionLabel?: string; // Label for description field
  defaultDescription?: string; // Default value for description
}

export default function InputDialog({
  open,
  title,
  label = 'Name',
  defaultValue = '',
  placeholder,
  onClose,
  onConfirm,
  validate,
  descriptionLabel = 'Description',
  defaultDescription = '',
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [description, setDescription] = useState(defaultDescription);
  const [error, setError] = useState<string | null>(null);

  // Reset form values when dialog opens
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setDescription(defaultDescription);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = () => {
    if (validate) {
      const errorMsg = validate(value);
      if (errorMsg) {
        setError(errorMsg);
        return;
      }
    }

    onConfirm(value, description);
    setValue('');
    setDescription('');
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setValue('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label={label}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            error={!!error}
            helperText={error}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleConfirm();
              }
            }}
          />
          {descriptionLabel && (
            <TextField
              fullWidth
              label={descriptionLabel}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Enter ${descriptionLabel.toLowerCase()}`}
              multiline
              rows={3}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!value.trim()}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
