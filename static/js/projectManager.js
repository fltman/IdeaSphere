class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentProjectId = null;
        
        // DOM elements
        this.projectSelector = document.getElementById('projectSelector');
        this.newProjectBtn = document.getElementById('newProjectBtn');
        this.projectModal = new bootstrap.Modal(document.getElementById('projectModal'));
        this.projectNameInput = document.getElementById('projectNameInput');
        this.saveProjectBtn = document.getElementById('saveProject');
        
        // Event listeners
        this.setupEventListeners();
        
        // Initialize by loading projects
        this.loadProjects();
    }
    
    setupEventListeners() {
        // Open new project modal
        this.newProjectBtn.addEventListener('click', () => {
            this.projectNameInput.value = '';
            this.projectModal.show();
        });
        
        // Save new project
        this.saveProjectBtn.addEventListener('click', () => {
            const projectName = this.projectNameInput.value.trim();
            if (projectName) {
                this.createProject(projectName);
            }
        });
        
        // Handle project selection
        this.projectSelector.addEventListener('change', () => {
            const projectId = this.projectSelector.value;
            if (projectId) {
                this.selectProject(projectId);
            }
        });
        
        // Add enter key support for project creation
        this.projectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveProjectBtn.click();
            }
        });
    }
    
    async loadProjects() {
        try {
            const response = await fetch('/get-projects');
            const data = await response.json();
            
            if (data.success) {
                this.projects = data.projects;
                this.updateProjectSelector();
                
                // If there are projects but none selected, select the first one
                if (this.projects.length > 0 && !this.currentProjectId) {
                    this.selectProject(this.projects[0].id);
                }
            } else {
                console.error('Failed to load projects:', data.error);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }
    
    async createProject(name) {
        try {
            const response = await fetch('/create-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: name })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.projects.push(data.project);
                this.updateProjectSelector();
                this.selectProject(data.project.id);
                this.projectModal.hide();
            } else {
                console.error('Failed to create project:', data.error);
            }
        } catch (error) {
            console.error('Error creating project:', error);
        }
    }
    
    selectProject(projectId) {
        this.currentProjectId = projectId;
        this.projectSelector.value = projectId;
        
        // Dispatch an event to notify other components
        const event = new CustomEvent('project-selected', {
            detail: { projectId: projectId }
        });
        document.dispatchEvent(event);
        
        // Load ideas for this project
        this.loadIdeasForProject(projectId);
    }
    
    async loadIdeasForProject(projectId) {
        try {
            const response = await fetch(`/get-ideas?project_id=${projectId}`);
            const data = await response.json();
            
            if (data.success) {
                // Clear the workspace first
                const clearEvent = new CustomEvent('clear-workspace');
                document.dispatchEvent(clearEvent);
                
                // Dispatch an event with the ideas data
                const event = new CustomEvent('load-ideas', {
                    detail: { ideas: data.ideas }
                });
                document.dispatchEvent(event);
            } else {
                console.error('Failed to load ideas:', data.error);
            }
        } catch (error) {
            console.error('Error loading ideas:', error);
        }
    }
    
    updateProjectSelector() {
        // Clear current options
        while (this.projectSelector.options.length > 1) {
            this.projectSelector.remove(1);
        }
        
        // Add projects as options
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            this.projectSelector.appendChild(option);
        });
        
        // Update selected value if we have a current project
        if (this.currentProjectId) {
            this.projectSelector.value = this.currentProjectId;
        }
    }
    
    getCurrentProjectId() {
        return this.currentProjectId;
    }
    
    getProjectName(projectId) {
        const project = this.projects.find(p => p.id === parseInt(projectId));
        return project ? project.name : 'Unknown Project';
    }
}

// Initialize the project manager when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    window.projectManager = new ProjectManager();
}); 