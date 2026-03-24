import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppState, LLMConfig, Directory, Task, TaskType } from '@myocr/types';
import { dbService, ocrService, summaryService } from '@myocr/ipc-client';
import { llmConfigService } from '../services/configService';

interface AppContextType extends AppState {
  // LLM Config operations
  addLLMConfig: (config: LLMConfig) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setActiveConfig: (id: string) => void;
  
  // Directory operations
  createDirectory: (name: string, type: TaskType, description?: string) => void;
  updateDirectory: (id: string, name: string, description?: string) => void;
  deleteDirectory: (id: string) => void;
  setActiveDirectory: (id: string | undefined) => void;
  moveTaskToDirectory: (taskId: string, directoryId: string) => void;
  exportTaskToSummary: (taskId: string) => Promise<void>;
  
  // Task operations
  createTask: (directoryId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (directoryId: string, taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (directoryId: string, taskId: string) => void;
  reorderTasks: (directoryId: string, taskIds: string[]) => void;
  
  // Export operations
  exportTaskResult: (taskId: string) => string;
  exportDirectoryResults: (directoryId: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    llmConfigs: [],
    activeConfigId: undefined,
    directories: [],
    activeDirectoryId: undefined,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoTestComplete, setAutoTestComplete] = useState(false);

  // Load data from SQLite database via Electron IPC on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Use the new async method to get configs from database
        const [llmConfigs, directories] = await Promise.all([
          llmConfigService.getAllConfigs(),
          dbService.getAllDirectories(),
        ]);
        
        // Load tasks for each directory
        const directoriesWithTasks = await Promise.all(
          directories.map(async (dir) => {
            const dirWithTasks = await dbService.getDirectoryWithTasks(dir.id);
            return dirWithTasks || dir;
          })
        );

        setState({
          llmConfigs,
          activeConfigId: undefined,
          directories: directoriesWithTasks,
          activeDirectoryId: undefined,
        });
        
        // Note: Default directories are no longer auto-created
        // Users should create directories manually as needed
        
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load data from SQLite database:', error);
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // Auto-test all LLM configs after loading
  useEffect(() => {
    if (isLoaded && !autoTestComplete && state.llmConfigs.length > 0) {
      const autoTestConfigs = async () => {
        console.log('Auto-testing LLM configurations...');
        
        // Test each config with a delay to avoid overwhelming the network
        for (const config of state.llmConfigs) {
          try {
            console.log(`Testing config: ${config.name}`);
            const result = await llmConfigService.testConnection(config);
            
            // Update config with models if test succeeded
            if (result.success && result.models && result.models.length > 0) {
              await dbService.updateLLMConfig(config.id, { models: result.models });
              
              // Update local state
              setState(prev => ({
                ...prev,
                llmConfigs: prev.llmConfigs.map(c => 
                  c.id === config.id ? { ...c, models: result.models! } : c
                ),
              }));
            }
            
            console.log(`Test result for ${config.name}:`, result.success ? 'SUCCESS' : 'FAILED', result.message);
          } catch (error) {
            console.error(`Error testing ${config.name}:`, error);
          }
          
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setAutoTestComplete(true);
        console.log('Auto-testing complete!');
      };
      
      autoTestConfigs();
    }
  }, [isLoaded, autoTestComplete, state.llmConfigs]);

  // Initialize OCR service with API instances when configs change
  useEffect(() => {
    if (state.llmConfigs.length > 0) {
      ocrService.setApiInstances(state.llmConfigs);
      console.log(`OCR Service initialized with ${state.llmConfigs.length} API instance(s)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.llmConfigs.length]);

  // Initialize Summary service with API instances when configs change
  useEffect(() => {
    if (state.llmConfigs.length > 0) {
      summaryService.setApiInstances(state.llmConfigs);
      console.log(`Summary Service initialized with ${state.llmConfigs.length} API instance(s)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.llmConfigs.length]);

  // LLM Config operations
  const addLLMConfig = useCallback(async (config: LLMConfig) => {
    setState(prev => ({
      ...prev,
      llmConfigs: [...prev.llmConfigs, config],
    }));
    await llmConfigService.addConfig(config);
  }, []);

  const updateLLMConfig = useCallback(async (id: string, config: Partial<LLMConfig>) => {
    setState(prev => ({
      ...prev,
      llmConfigs: prev.llmConfigs.map(c => 
        c.id === id ? { ...c, ...config } : c
      ),
    }));
    await llmConfigService.updateConfig(id, config);
  }, []);

  const deleteLLMConfig = useCallback(async (id: string) => {
    setState(prev => ({
      ...prev,
      llmConfigs: prev.llmConfigs.filter(c => c.id !== id),
      activeConfigId: prev.activeConfigId === id ? undefined : prev.activeConfigId,
    }));
    await llmConfigService.deleteConfig(id);
  }, []);

  const setActiveConfig = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeConfigId: id }));
    // Don't persist this, it's UI state only
  }, []);

  // Directory operations
  const createDirectory = useCallback(async (name: string, type: TaskType = 'ocr', description?: string) => {
    const newDirectory: Directory = {
      id: crypto.randomUUID(),
      name,
      type,
      description: description || undefined,
      tasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setState(prev => ({
      ...prev,
      directories: [...prev.directories, newDirectory],
    }));
    
    // Persist to database using addDirectory
    try {
      await dbService.addDirectory(newDirectory);
      console.log('Directory created in database:', newDirectory.id);
    } catch (error) {
      console.error('Failed to create directory in database:', error);
      // Rollback state if database save fails
      setState(prev => ({
        ...prev,
        directories: prev.directories.filter(d => d.id !== newDirectory.id),
      }));
    }
  }, []);

  const updateDirectory = useCallback(async (id: string, name: string, description?: string) => {
    // Get the directory to find its type before updating
    let originalDirectory: Directory | undefined;
    setState(prev => {
      originalDirectory = prev.directories.find(d => d.id === id);
      return {
        ...prev,
        directories: prev.directories.map(d =>
          d.id === id ? { ...d, name, description: description !== undefined ? description : d.description, updatedAt: new Date() } : d
        ),
      };
    });
    
    // Persist to database using updateDirectory
    try {
      if (originalDirectory) {
        await dbService.updateDirectory(id, {
          ...originalDirectory,
          name,
          description: description !== undefined ? description : originalDirectory.description,
          updatedAt: new Date(),
        });
        console.log('Directory updated in database:', id);
      }
    } catch (error) {
      console.error('Failed to update directory in database:', error);
      // Rollback state if database save fails
      setState(prev => ({
        ...prev,
        directories: prev.directories.map(d =>
          d.id === id ? originalDirectory! : d
        ),
      }));
    }
  }, []);

  const deleteDirectory = useCallback(async (id: string) => {
    const directoryToDelete = state.directories.find(d => d.id === id);
    
    setState(prev => ({
      ...prev,
      directories: prev.directories.filter(d => d.id !== id),
      activeDirectoryId: prev.activeDirectoryId === id ? undefined : prev.activeDirectoryId,
    }));
    
    // Persist to database using deleteDirectory
    try {
      await dbService.deleteDirectory(id);
      console.log('Directory deleted from database:', id);
    } catch (error) {
      console.error('Failed to delete directory from database:', error);
      // Rollback state if database save fails
      if (directoryToDelete) {
        setState(prev => ({
          ...prev,
          directories: [...prev.directories, directoryToDelete],
        }));
      }
    }
  }, [state.directories]);

  const setActiveDirectory = useCallback(async (id: string | undefined) => {
    // Load directory with tasks when selected
    try {
      if (!id) {
        // User is deselecting (clicking on the type header, not a specific directory)
        console.log('[AppContext] No directory ID provided, just updating activeDirectoryId to undefined');
        setState(prev => ({
          ...prev,
          activeDirectoryId: undefined,
        }));
        return;
      }
      
      const directoryWithTasks = await dbService.getDirectoryWithTasks(id);
      
      if (directoryWithTasks) {
        setState(prev => ({
          ...prev,
          activeDirectoryId: id,
          directories: prev.directories.map(d => 
            d.id === id ? directoryWithTasks : d
          ),
        }));
      }
    } catch (error) {
      console.error('Failed to load directory with tasks:', error);
    }
  }, []);

  const moveTaskToDirectory = useCallback(async (taskId: string, directoryId: string) => {
    setState(prev => {
      const newState = {
        ...prev,
        directories: prev.directories.map(d => {
          if (d.id === directoryId) {
            // Find task in other directories
            const allTasks = prev.directories.flatMap(dir => dir.tasks);
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
              return {
                ...d,
                tasks: [...d.tasks, task],
                updatedAt: new Date(),
              };
            }
          }
          // Remove task from current directory
          if (d.tasks.some(t => t.id === taskId)) {
            return {
              ...d,
              tasks: d.tasks.filter(t => t.id !== taskId),
              updatedAt: new Date(),
            };
          }
          return d;
        }),
      };
      // Persist the entire updated state
      dbService.saveAppState(newState).catch(console.error);
      return newState;
    });
  }, []);

  // Export task to summary directory
  const exportTaskToSummary = useCallback(async (taskId: string) => {
    setState(prev => {
      // Find the source task
      const allTasks = prev.directories.flatMap(d => d.tasks);
      const sourceTask = allTasks.find(t => t.id === taskId);
      
      if (!sourceTask) {
        console.error('Task not found:', taskId);
        return prev;
      }

      // Find or create a default summary directory
      const summaryDir = prev.directories.find(d => d.type === 'summary') ?? { id: '' };
      
      if (!summaryDir) {
        console.warn('No summary directory found, please create one first');
        return prev;
      }

      // Create a new task in summary directory with copied data
      const newTask: Task = {
        ...sourceTask,
        id: crypto.randomUUID(),
        type: 'summary',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newState = {
        ...prev,
        directories: prev.directories.map(d => {
          if (d.id === summaryDir!.id) {
            return {
              ...d,
              tasks: [...d.tasks, newTask],
              updatedAt: new Date(),
            };
          }
          return d;
        }),
      };

      // Persist the updated state
      dbService.saveAppState(newState).catch(console.error);
      return newState;
    });
  }, []);

  // Task operations
  const createTask = useCallback(async (directoryId: string, taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Debug: Log task creation data
    console.log('Creating task with data:', {
      name: newTask.name,
      type: newTask.type,
      apiConfigId: newTask.apiConfigId,
      selectedModel: newTask.selectedModel,
      temperature: newTask.temperature,
      maxTokens: newTask.maxTokens,
    });
    
    setState(prev => ({
      ...prev,
      directories: prev.directories.map(d => {
        if (d.id === directoryId) {
          return {
            ...d,
            tasks: [...d.tasks, newTask],
            updatedAt: new Date(),
          };
        }
        return d;
      }),
    }));
    
    // Persist to database - save to both app state (for caching) and ocr_tasks table
    try {
      // Save to app state for caching
      const newState = await dbService.getAppState();
      if (newState) {
        newState.directories = newState.directories.map(d => {
          if (d.id === directoryId) {
            return {
              ...d,
              tasks: [...d.tasks, newTask],
              updatedAt: new Date(),
            };
          }
          return d;
        });
        await dbService.saveAppState(newState);
      }
      
      // Save to ocr_tasks table for persistent storage
      if (newTask.type === 'ocr') {
        // Extract pure base64 from data URL for storage
        let pureBase64 = '';
        let mimeType = 'image/png';
        
        if (newTask.imageUrl) {
          if (newTask.imageUrl.startsWith('data:')) {
            const commaIndex = newTask.imageUrl.indexOf(',');
            pureBase64 = commaIndex > -1 ? newTask.imageUrl.substring(commaIndex + 1) : newTask.imageUrl;
            
            // Extract MIME type from data URL
            const mimeMatch = newTask.imageUrl.match(/^data:([^;]+);base64,/);
            if (mimeMatch) {
              mimeType = mimeMatch[1];
            }
          } else {
            // Already pure base64
            pureBase64 = newTask.imageUrl;
          }
        }
        
        await dbService.createOcrTask({
          id: newTask.id,
          directoryId: directoryId,
          name: newTask.name,
          status: newTask.status,
          imageData: pureBase64, // Store pure base64 (no data URL prefix)
          imageMimeType: mimeType, // Extract actual MIME type
          imageName: newTask.name,
          apiConfigId: newTask.apiConfigId,
          selectedModel: newTask.selectedModel,
          temperature: newTask.temperature,
          maxTokens: newTask.maxTokens,
          customPrompt: newTask.customPrompt,
          metadata: {
            memoryUsage: newTask.memoryUsage,
            memoryConfig: newTask.memoryConfig,
            textSplitConfig: newTask.textSplitConfig,
          },
        });
        
        console.log('Task saved to ocr_tasks table:', newTask.id);
      } else if (newTask.type === 'summary') {
        // Save to summary_tasks table for summary tasks
        console.log('[AppContext] Creating summary task with inputText:', {
          taskId: newTask.id,
          inputTextLength: newTask.inputText?.length || 0,
          hasInputText: !!newTask.inputText,
        });
        
        await dbService.createSummaryTask({
          id: newTask.id,
          directoryId: directoryId,
          name: newTask.name,
          status: newTask.status,
          inputText: newTask.inputText || '', // Store input text from task
          apiConfigId: newTask.apiConfigId,
          selectedModel: newTask.selectedModel,
          temperature: newTask.temperature,
          maxTokens: newTask.maxTokens,
          customPrompt: newTask.customPrompt,
          resultFormat: (newTask as { resultFormat?: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml' }).resultFormat || 'plaintext',
          metadata: {
            memoryUsage: newTask.memoryUsage,
            memoryConfig: newTask.memoryConfig,
            textSplitConfig: newTask.textSplitConfig,
          },
        });
        
        console.log('Summary task saved to summary_tasks table:', newTask.id);
      } else if (newTask.type === 'prompt') {
        // Save to prompts table for prompt templates
        await dbService.createPrompt({
          id: newTask.id,
          directoryId: directoryId,
          name: newTask.name,
          content: newTask.result || '', // Store prompt content in content field
          type: 'custom',
          description: (newTask as { description?: string }).description || undefined,
          category: undefined,
          variables: [],
          isPublic: false,
          usageCount: 0,
          isFavorite: false,
          version: 1,
          parentId: undefined,
          metadata: undefined,
        });
        
        console.log('Prompt template saved to prompts table:', newTask.id);
      }
    } catch (error) {
      console.error('Failed to create task in database:', error);
    }
    
    return newTask.id; // Return the created task ID
  }, []);

  const updateTask = useCallback(async (directoryId: string, taskId: string, updates: Partial<Task>): Promise<void> => {
    // Get the task to determine its type
    let taskType: 'ocr' | 'summary' | 'prompt' | null = null;
    setState(prev => {
      const directory = prev.directories.find(d => d.id === directoryId);
      const task = directory?.tasks.find(t => t.id === taskId);
      if (task) {
        taskType = task.type as 'ocr' | 'summary' | 'prompt';
      }
      return prev; // Don't update state yet
    });
    
    console.log('[AppContext.updateTask] Updating task:', {
      directoryId,
      taskId,
      taskType,
      updates: {
        ...updates,
        result: updates.result ? `${updates.result.length} chars` : undefined,
      },
    });
    
    setState(prev => ({
      ...prev,
      directories: prev.directories.map(d => {
        if (d.id === directoryId) {
          return {
            ...d,
            tasks: d.tasks.map(t =>
              t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
            ),
            updatedAt: new Date(),
          };
        }
        return d;
      }),
    }));
    
    // Persist to database based on task type
    try {
      // Save to app state for caching
      const newState = await dbService.getAppState();
      if (newState) {
        newState.directories = newState.directories.map(d => {
          if (d.id === directoryId) {
            return {
              ...d,
              tasks: d.tasks.map(t =>
                t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
              ),
              updatedAt: new Date(),
            };
          }
          return d;
        });
        console.log('[AppContext.updateTask] Saving app state with updated task');
        await dbService.saveAppState(newState);
        console.log('[AppContext.updateTask] App state saved successfully');
      }
      
      // Update database table based on task type
      console.log('[AppContext.updateTask] Calling dbService.update method for task type:', taskType);
      if (taskType === 'prompt') {
        // For prompt tasks, update the prompts table
        // Map Task fields to Prompt fields
        const promptUpdates: { name?: string; content?: string; description?: string } = {};
        if (updates.name !== undefined) promptUpdates.name = updates.name;
        if (updates.result !== undefined) promptUpdates.content = updates.result; // Map result to content
        if ((updates as { description?: string }).description !== undefined) promptUpdates.description = (updates as { description?: string }).description;
        
        await dbService.updatePrompt(taskId, promptUpdates);
        console.log('[AppContext.updateTask] Prompt updated in prompts table:', taskId);
      } else if (taskType === 'summary') {
        // For summary tasks, update the summary_tasks table
        await dbService.updateSummaryTask(taskId, updates);
        console.log('[AppContext.updateTask] Summary task updated in summary_tasks table:', taskId);
      } else {
        // For OCR tasks, update the ocr_tasks table
        await dbService.updateOcrTask(taskId, updates);
        console.log('[AppContext.updateTask] OCR task updated in ocr_tasks table:', taskId);
      }
    } catch (error) {
      console.error('[AppContext.updateTask] Failed to update task in database:', error);
    }
  }, []);

  const deleteTask = useCallback(async (directoryId: string, taskId: string) => {
    // Get the directory and task to determine task type
    setState(prev => {
      const directory = prev.directories.find(d => d.id === directoryId);
      const task = directory?.tasks.find(t => t.id === taskId);
      
      // Update state immediately for responsive UI
      const newState = {
        ...prev,
        directories: prev.directories.map(d => {
          if (d.id === directoryId) {
            return {
              ...d,
              tasks: d.tasks.filter(t => t.id !== taskId),
              updatedAt: new Date(),
            };
          }
          return d;
        }),
      };
      
      // Persist to database - delete from both app state and appropriate table
      (async () => {
        try {
          const appState = await dbService.getAppState();
          if (appState) {
            appState.directories = appState.directories.map(d => {
              if (d.id === directoryId) {
                return {
                  ...d,
                  tasks: d.tasks.filter(t => t.id !== taskId),
                  updatedAt: new Date(),
                };
              }
              return d;
            });
            await dbService.saveAppState(appState);
          }
          
          // Delete from appropriate table based on task type
          if (task?.type === 'prompt') {
            // Delete from prompts table
            await dbService.deletePrompt(taskId);
            console.log('Prompt template deleted from prompts table:', taskId);
          } else if (task?.type === 'summary') {
            // Delete from summary_tasks table
            await dbService.deleteSummaryTask(taskId);
            console.log('Summary task deleted from summary_tasks table:', taskId);
          } else {
            // Delete from ocr_tasks table
            await dbService.deleteOcrTask(taskId);
            console.log('OCR task deleted from ocr_tasks table:', taskId);
          }
        } catch (error) {
          console.error('Failed to delete task from database:', error);
        }
      })();
      
      return newState;
    });
  }, []);

  const reorderTasks = useCallback(async (directoryId: string, taskIds: string[]) => {
    setState(prev => ({
      ...prev,
      directories: prev.directories.map(d => {
        if (d.id === directoryId) {
          const reorderedTasks = taskIds
            .map(id => d.tasks.find(t => t.id === id))
            .filter((t): t is Task => !!t);
          return {
            ...d,
            tasks: reorderedTasks,
            updatedAt: new Date(),
          };
        }
        return d;
      }),
    }));
    
    const directory = await dbService.getDirectory(directoryId);
    if (directory) {
      const taskMap = new Map(taskIds.map(id => [id, directory.tasks.find(t => t.id === id)]));
      directory.tasks = taskIds
        .map(id => taskMap.get(id))
        .filter((t): t is Task => !!t);
      directory.updatedAt = new Date();
      await dbService.updateDirectory(directoryId, directory);
    }
  }, []);

  // Export operations
  const exportTaskResult = useCallback((taskId: string) => {
    const allTasks = state.directories.flatMap(d => d.tasks);
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return '';
    
    return `Task: ${task.name}\nDate: ${task.createdAt.toLocaleString()}\n\nResult:\n${task.result || 'No result yet'}\n`;
  }, [state.directories]);

  const exportDirectoryResults = useCallback((directoryId: string) => {
    const directory = state.directories.find(d => d.id === directoryId);
    if (!directory) return '';
    
    const results = directory.tasks.map(task => 
      `Task: ${task.name}\nDate: ${task.createdAt.toLocaleString()}\n\nResult:\n${task.result || 'No result yet'}\n\n${'='.repeat(50)}\n`
    ).join('\n');
    
    return `Directory: ${directory.name}\nExported: ${new Date().toLocaleString()}\n\n${results}`;
  }, [state.directories]);

  const value: AppContextType = {
    ...state,
    addLLMConfig,
    updateLLMConfig,
    deleteLLMConfig,
    setActiveConfig,
    createDirectory,
    updateDirectory,
    deleteDirectory,
    setActiveDirectory,
    moveTaskToDirectory,
    exportTaskToSummary,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    exportTaskResult,
    exportDirectoryResults,
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
