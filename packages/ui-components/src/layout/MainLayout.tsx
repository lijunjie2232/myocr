import { useState } from 'react';
import {
  Box,
  Container,
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Collapse,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { AppProvider, useAppContext } from '../context/AppContext';
import SettingsDialog from '../settings/SettingsDialog';
import DirectoryList from '../directory/DirectoryList';
import TaskList from '../tasks/OcrTaskList';
import PromptTaskList from '../tasks/PromptTaskList';
import SummaryTaskList from '../tasks/SummaryTaskList';
import type { TaskType } from '@myocr/types';

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

interface MainLayoutContentProps {
  onOpenSettings: () => void;
}

const MainLayoutContent: React.FC<MainLayoutContentProps> = () => {
  const { directories, activeDirectoryId, setActiveDirectory } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedType, setExpandedType] = useState<TaskType | null>(null);
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };



  const handleTypeClick = (type: TaskType) => {
    if (selectedType === type) {
      // Collapse and deselect
      setExpandedType(null);
      setSelectedType(null);
      setActiveDirectory(undefined);
    } else {
      // Expand and select this type
      setExpandedType(type);
      setSelectedType(type);
      setActiveDirectory(undefined);
    }
  };

  // Filter directories by type
  const ocrDirectories = directories.filter(d => d.type === 'ocr');
  const summaryDirectories = directories.filter(d => d.type === 'summary');
  const promptDirectories = directories.filter(d => d.type === 'prompt');

  const drawer = (
    <Box>
      <Toolbar />
      <Divider />
      <List>
        {/* OCR Task Type */}
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleTypeClick('ocr')}
            selected={selectedType === 'ocr'}
          >
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary="OCR Tasks" />
            {expandedType === 'ocr' ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={expandedType === 'ocr'} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {ocrDirectories.length === 0 ? (
              <ListItem sx={{ pl: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  No OCR directories yet. Click + to create one.
                </Typography>
              </ListItem>
            ) : (
              ocrDirectories.map((directory) => (
                <ListItemButton
                  key={directory.id}
                  sx={{ pl: 4 }}
                  selected={activeDirectoryId === directory.id}
                  onClick={() => setActiveDirectory(directory.id)}
                >
                  <ListItemText primary={directory.name} />
                </ListItemButton>
              ))
            )}
          </List>
        </Collapse>

        {/* Summary Task Type */}
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleTypeClick('summary')}
            selected={selectedType === 'summary'}
          >
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary="Summary" />
            {expandedType === 'summary' ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={expandedType === 'summary'} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {summaryDirectories.length === 0 ? (
              <ListItem sx={{ pl: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  No Summary directories yet. Click + to create one.
                </Typography>
              </ListItem>
            ) : (
              summaryDirectories.map((directory) => (
                <ListItemButton
                  key={directory.id}
                  sx={{ pl: 4 }}
                  selected={activeDirectoryId === directory.id}
                  onClick={() => setActiveDirectory(directory.id)}
                >
                  <ListItemText primary={directory.name} />
                </ListItemButton>
              ))
            )}
          </List>
        </Collapse>

        {/* Prompt Template Task Type */}
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleTypeClick('prompt')}
            selected={selectedType === 'prompt'}
          >
            <ListItemIcon>
              <FolderIcon />
            </ListItemIcon>
            <ListItemText primary="Prompt Templates" />
            {expandedType === 'prompt' ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={expandedType === 'prompt'} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {promptDirectories.length === 0 ? (
              <ListItem sx={{ pl: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  No Prompt Template directories yet. Click + to create one.
                </Typography>
              </ListItem>
            ) : (
              promptDirectories.map((directory) => (
                <ListItemButton
                  key={directory.id}
                  sx={{ pl: 4 }}
                  selected={activeDirectoryId === directory.id}
                  onClick={() => setActiveDirectory(directory.id)}
                >
                  <ListItemText primary={directory.name} />
                </ListItemButton>
              ))
            )}
          </List>
        </Collapse>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <FolderIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            MyOCR - OCR with LLM
          </Typography>
          <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Container maxWidth="lg">
          {selectedType && activeDirectoryId ? (
            selectedType === 'prompt' ? (
              <PromptTaskList directoryId={activeDirectoryId} />
            ) : selectedType === 'summary' ? (
              <SummaryTaskList directoryId={activeDirectoryId} />
            ) : (
              <TaskList directoryId={activeDirectoryId} />
            )
          ) : selectedType ? (
            <DirectoryList type={selectedType} />
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Select a task type from the sidebar
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose OCR Tasks, Summary, or Prompt Templates to view and manage directories
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
      
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
};

export function MainLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AppProvider>
        <MainLayoutContent onOpenSettings={() => {}} />
      </AppProvider>
    </ThemeProvider>
  );
}

export default MainLayout;
