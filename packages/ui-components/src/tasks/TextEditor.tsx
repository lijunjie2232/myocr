import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ViewListIcon from '@mui/icons-material/ViewList';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/Check';

interface TextEditorProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  subtitle?: string;
  onSave: (newContent: string) => Promise<void>;
  onExport?: () => void;
  showSidebar?: boolean;
  sidebarItems?: Array<{
    id: string;
    name: string;
    preview?: string;
    onClick: () => void;
  }>;
  activeItemId?: string;
  isSaving?: boolean;
}

export default function TextEditor({
  open,
  onClose,
  title,
  content,
  subtitle,
  onSave,
  onExport,
  showSidebar = false,
  sidebarItems = [],
  activeItemId,
  isSaving = false,
}: TextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<{ start: number; end: number }[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content when it changes from outside
  useEffect(() => {
    console.log('[TextEditor] Content sync triggered:', {
      contentLength: content.length,
      isEditing,
      editedContentLength: editedContent.length,
      willSync: !isEditing,
    });
    if (!isEditing) {
      setEditedContent(content);
      setHasChanges(false);
      console.log('[TextEditor] Content synced to:', content.substring(0, 50) + '...');
    } else {
      console.log('[TextEditor] Skipping sync because isEditing=true');
    }
  }, [content, isEditing]);

  // Reset state when dialog closes
  useEffect(() => {
    console.log('[TextEditor] Dialog state changed:', { open });
    if (!open) {
      console.log('[TextEditor] Closing dialog, resetting editing state but keeping content for next open');
      setIsEditing(false);
      setHasChanges(false);
      setSaveError(null);
      setSearchQuery('');
      setCaseSensitive(false);
      setUseRegex(false);
      setCurrentMatchIndex(-1);
      setMatches([]);
      // Note: Don't clear editedContent here - it will be synced with new content prop on next open
    } else {
      console.log('[TextEditor] Opening dialog with content length:', content.length);
      // Ensure content is synced when opening
      setEditedContent(content);
    }
  }, [open, content]);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditedContent(newContent);
    setHasChanges(newContent !== content);
  };

  // Toggle edit mode
  const handleToggleEdit = async () => {
    if (isEditing) {
      // Switching back to view mode - need to confirm if has changes
      await handleExitEditMode();
    } else {
      // Entering edit mode
      setIsEditing(true);
    }
  };

  // Save changes
  const handleSave = async () => {
    try {
      setSaveError(null);
      await onSave(editedContent);
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setEditedContent(content);
    setHasChanges(false);
    setSaveError(null);
    setIsEditing(false);
  };

  // Confirm discard changes
  const confirmDiscardChanges = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmed = window.confirm('Do you confirm to discard the changes?');
      resolve(confirmed); // true = OK (discard), false = Cancel (keep editing)
    });
  };

  // Close dialog
  const handleClose = async () => {
    if (hasChanges) {
      const confirmed = await confirmDiscardChanges();
      if (!confirmed) {
        // User clicked "Cancel" - do not close
        return;
      }
      // User clicked "OK" - discard changes and close
    }
    onClose();
  };

  // Exit edit mode (switch to view mode)
  const handleExitEditMode = async () => {
    if (hasChanges) {
      const confirmed = await confirmDiscardChanges();
      if (!confirmed) {
        // User clicked "Cancel" - stay in edit mode
        return;
      }
      // User clicked "OK" - discard changes and exit edit mode
    }
    // Restore original content and exit edit mode
    setEditedContent(content);
    setHasChanges(false);
    setSaveError(null);
    setIsEditing(false);
  };

  // Find matches (for search in view mode)
  useEffect(() => {
    if (!searchQuery || !editedContent || isEditing) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const newMatches: { start: number; end: number }[] = [];
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = useRegex 
        ? new RegExp(searchQuery, flags) 
        : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      
      let match;
      while ((match = regex.exec(editedContent)) !== null) {
        newMatches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
      
      setMatches(newMatches);
      setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
    } catch (error) {
      console.error('Search error:', error);
      setMatches([]);
      setCurrentMatchIndex(-1);
    }
  }, [searchQuery, editedContent, caseSensitive, useRegex, isEditing]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedContent);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Render highlighted text for view mode
  const renderHighlightedText = useMemo(() => {
    if (!editedContent) {
      return 'No content available';
    }

    if (!searchQuery || matches.length === 0 || isEditing) {
      return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {editedContent}
        </span>
      );
    }

    const parts = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      if (match.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {editedContent.substring(lastIndex, match.start)}
          </span>
        );
      }

      parts.push(
        <mark
          key={`match-${index}`}
          data-match-index={index}
          style={{
            backgroundColor: index === currentMatchIndex ? '#ffeb3b' : '#ffff00',
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          {editedContent.substring(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    });

    if (lastIndex < editedContent.length) {
      parts.push(
        <span key="text-end">
          {editedContent.substring(lastIndex)}
        </span>
      );
    }

    return <span style={{ whiteSpace: 'pre-wrap' }}>{parts}</span>;
  }, [editedContent, searchQuery, matches, currentMatchIndex, isEditing]);

  // Generate line numbers with 10 additional blank lines at the end
  const lineNumbers = useMemo(() => {
    if (!editedContent) return [];
    const lines = editedContent.split('\n');
    // If content ends with newline, remove the last empty element for line number calculation
    // but only if it's truly empty (not just a line with spaces)
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      const contentLines = lines.slice(0, -1);
      // Add 10 blank lines at the end
      const totalLines = [...contentLines, ...Array(10).fill('')];
      return totalLines.map((_, index) => index + 1);
    }
    // Add 10 blank lines at the end
    const totalLines = [...lines, ...Array(10).fill('')];
    return totalLines.map((_, index) => index + 1);
  }, [editedContent]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen
      disableEscapeKeyDown={!isEditing} // Prevent ESC closing while editing
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {showSidebar && (
              <IconButton
                size="small"
                onClick={() => {}}
                sx={{
                  transform: showSidebar ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              >
                <ViewListIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="h6" component="span">
                {title} {hasChanges && '*'}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isEditing ? (
              <>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={handleToggleEdit} color="primary">
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy to Clipboard">
                  <IconButton size="small" onClick={handleCopy}>
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
                {onExport && (
                  <Button variant="outlined" size="small" onClick={onExport}>
                    Export
                  </Button>
                )}
              </>
            ) : (
              <>
                <Tooltip title="Cancel Changes">
                  <IconButton size="small" onClick={handleCancel} color="default">
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Save Changes">
                  <IconButton 
                    size="small" 
                    onClick={handleSave} 
                    color="success"
                    disabled={!hasChanges || isSaving}
                  >
                    {isSaving ? <CircularProgress size={24} /> : <SaveIcon />}
                  </IconButton>
                </Tooltip>
              </>
            )}
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#fafafa',
          }}
        >
          {/* Error Alert */}
          {saveError && (
            <Alert severity="error" sx={{ m: 2 }}>
              {saveError}
            </Alert>
          )}

          {/* Text Content with Line Numbers */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              overflow: 'auto',
              position: 'relative',
              backgroundColor: '#fafafa',
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
                flexShrink: 0,
                height: 'fit-content',
                minHeight: '100%',
              }}
            >
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </Box>

            {/* Text Content / Editor */}
            {isEditing ? (
              <TextField
                inputRef={textAreaRef}
                multiline
                value={editedContent}
                onChange={handleContentChange}
                variant="outlined"
                placeholder="Enter your content here..."
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    border: 'none',
                    borderRadius: 0,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    p: 3,
                    backgroundColor: '#fafafa',
                  },
                }}
              />
            ) : (
              <Box
                sx={{
                  flex: 1,
                  p: 3,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  overflow: 'visible',
                  backgroundColor: '#fafafa',
                }}
              >
                {renderHighlightedText}
              </Box>
            )}
          </Box>

          {/* Search Bar - Only in view mode */}
          {!isEditing && (
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
                    // handleFindNext();
                  } else if (e.key === 'F3') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      // handleFindPrevious();
                    } else {
                      // handleFindNext();
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

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 120,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No matches'}
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
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {isEditing && (
          <Box sx={{ display: 'flex', gap: 1, mr: 'auto' }}>
            <Button 
              onClick={handleCancel} 
              color="inherit"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained"
              disabled={!hasChanges || isSaving}
              startIcon={isSaving ? <CircularProgress size={20} /> : <CheckIcon />}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        )}
        <Button onClick={handleClose}>
          {isEditing ? 'Close without Saving' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
