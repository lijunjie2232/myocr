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

interface TextContentViewerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  subtitle?: string;
  onExport?: () => void;
  showSidebar?: boolean;
  sidebarItems?: Array<{
    id: string;
    name: string;
    preview?: string;
    onClick: () => void;
  }>;
  activeItemId?: string;
  onEdit?: () => void; // New prop for edit button
}

export default function TextContentViewer({
  open,
  onClose,
  title,
  content,
  subtitle,
  onExport,
  showSidebar = false,
  sidebarItems = [],
  activeItemId,
  onEdit,
}: TextContentViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<{ start: number; end: number }[]>([]);
  const textContentRef = useRef<HTMLDivElement>(null);

  // Find matches
  useEffect(() => {
    if (!searchQuery || !content) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const newMatches: { start: number; end: number }[] = [];
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = useRegex ? new RegExp(searchQuery, flags) : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      
      let match;
      while ((match = regex.exec(content)) !== null) {
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
  }, [searchQuery, content, caseSensitive, useRegex]);

  // Scroll to current match
  const scrollToMatch = (index: number) => {
    if (!textContentRef.current || index < 0 || index >= matches.length) return;

    const match = matches[index];
    const element = textContentRef.current.querySelector(`[data-match-index="${index}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Render highlighted text
  const renderHighlightedText = useMemo(() => {
    if (!content) {
      return 'No content available';
    }

    if (!searchQuery || matches.length === 0) {
      return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </span>
      );
    }

    const parts = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      if (match.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {content.substring(lastIndex, match.start)}
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
          {content.substring(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    });

    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">
          {content.substring(lastIndex)}
        </span>
      );
    }

    return <span style={{ whiteSpace: 'pre-wrap' }}>{parts}</span>;
  }, [content, searchQuery, matches, currentMatchIndex]);

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    if (!content) return [];
    return content.split('\n').map((_, index) => index + 1);
  }, [content]);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {showSidebar && (
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                sx={{
                  transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              >
                <ViewListIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="h6" component="span">
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={onEdit} color="primary">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
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
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {showSidebar && (
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
                <Typography variant="subtitle2" fontWeight="bold">
                  Items ({sidebarItems.length})
                </Typography>
              </Box>

              <List sx={{ p: 0, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                {sidebarItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={activeItemId === item.id}
                        onClick={item.onClick}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: activeItemId === item.id ? 'action.selectedHover' : 'action.hover',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <VisibilityIcon color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.name}
                          secondary={
                            item.preview && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {item.preview.substring(0, 50)}...
                              </Typography>
                            )
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < sidebarItems.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Drawer>
          </Box>
        )}

        {/* Main Content */}
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
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
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
              {renderHighlightedText}
            </Box>
          </Box>

          {/* Search Bar */}
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
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
