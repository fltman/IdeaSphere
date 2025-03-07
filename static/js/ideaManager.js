class IdeaManager {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
        this.ideas = [];
        this.connections = [];
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.selectedIdea = null;
        this.isSelectMode = false;
        this.selectedIdeas = [];
        this.activeTooltip = null;
        this.isMergeMode = false;
        this.mergeIdeas = [];
        this.generatedIdeas = [];
        this.maxHistoryItems = 10;
        this.timer = null;
        this.timerDuration = 5 * 1000;
        this.remainingTime = this.timerDuration;
        this.isTimerPaused = false;
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.velocities = new Map();
        this.lastFrameTime = performance.now();
        this.animationFrame = null;
        this.currentRating = 0;
        // Project-specific history storage
        this.ideaHistoryByProject = new Map();
        this.currentProjectId = null;

        // Initialize the ideas list reference
        this.ideasList = document.getElementById('ideas-list');
        
        if (!this.ideasList) {
            console.warn('Ideas list element not found in the DOM');
        }

        this.setupEventListeners();
        this.updateCountdownDisplay();
        this.startPhysicsLoop();

        window.addEventListener('resize', () => {
            this.drawConnections();
        });

        // Add toggle functionality for ideas history
        this.setupHistoryToggle();
        this.setupRatingSystem();
        
        // Add project-related event listeners
        this.setupProjectEventListeners();
    }

    setupEventListeners() {
        this.workspace.addEventListener('click', (e) => {
            if (e.target === this.workspace) {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft;
                const y = e.clientY - rect.top + this.workspace.scrollTop;
                
                const event = new CustomEvent('workspace-click', {
                    detail: { x, y }
                });
                document.dispatchEvent(event);
            }
        });
    }

    enterSelectMode() {
        this.isSelectMode = true;
        this.selectedIdeas = [];
        this.ideas.forEach(idea => {
            idea.element.addEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'pointer';
        });
    }

    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedIdeas.forEach(idea => {
            idea.element.classList.remove('merge-mode');
        });
        this.ideas.forEach(idea => {
            idea.element.removeEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'move';
        });
        this.selectedIdeas = [];
    }

    handleIdeaSelection = (e) => {
        e.stopPropagation();
        const clickedElement = e.currentTarget;
        const idea = this.ideas.find(i => i.element === clickedElement);
        
        if (idea) {
            const index = this.selectedIdeas.findIndex(i => i === idea);
            if (index === -1 && this.selectedIdeas.length < 2) {
                this.selectedIdeas.push(idea);
                clickedElement.classList.add('merge-mode');
            } else if (index !== -1) {
                this.selectedIdeas.splice(index, 1);
                clickedElement.classList.remove('merge-mode');
            }
        }
    }

    updateCountdownDisplay() {
        if (!this.timerEndTime) return;
        
        const timeLeft = Math.max(0, this.remainingTime);
        const seconds = Math.floor(timeLeft / 1000);
        
        if (this.countdownDisplay) {
            this.countdownDisplay.textContent = seconds.toString();
        }
    }

    handleTimerExpired() {
        // Get all visible idea balls
        const visibleIdeas = Array.from(this.ideas).filter(idea => 
            !idea.element.classList.contains('generating') && 
            idea.element.style.display !== 'none'
        );

        if (visibleIdeas.length >= 2) {
            // Randomly select two different ideas
            const idea1 = visibleIdeas[Math.floor(Math.random() * visibleIdeas.length)];
            let idea2;
            do {
                idea2 = visibleIdeas[Math.floor(Math.random() * visibleIdeas.length)];
            } while (idea2 === idea1);

            // Select both ideas for merging
            this.mergeIdeas = [idea1, idea2];
            
            // Add visual indication
            idea1.element.classList.add('merge-mode');
            idea2.element.classList.add('merge-mode');
            
            // Trigger the merge
            this.handleMerge();
        }

        // Restart the timer
        this.startTimer();
    }

    startTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timerEndTime = Date.now() + this.timerDuration;
        this.remainingTime = this.timerDuration;
        
        this.timer = setInterval(() => {
            if (!this.isTimerPaused) {
                const now = Date.now();
                const timeLeft = Math.max(0, this.timerEndTime - now);
                this.remainingTime = timeLeft;
                
                this.updateCountdownDisplay();
                
                if (timeLeft === 0) {
                    this.handleTimerExpired();
                }
            }
        }, 100);
        
        this.updateCountdownDisplay();
    }

    pauseTimer() {
        this.isTimerPaused = true;
    }

    resumeTimer() {
        this.isTimerPaused = false;
        if (this.timer) {
            this.timerEndTime = Date.now() + this.remainingTime;
        }
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.timerEndTime = null;
            this.remainingTime = this.timerDuration;
            this.updateCountdownDisplay();
        }
    }

    setTimerDuration(seconds) {
        this.timerDuration = seconds * 1000;
        this.remainingTime = this.timerDuration;
        this.updateCountdownDisplay();
    }

    startPhysicsLoop() {
        const animate = () => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            this.updatePhysics(deltaTime);
            this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    stopPhysicsLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    updatePhysics(deltaTime) {
        const damping = 0.85;
        const minSpeed = 0.5;
        const leftBoundary = 950;

        for (const idea of this.ideas) {
            if (!this.isDragging || idea.element !== this.selectedIdea) {
                let velocity = this.velocities.get(idea) || { x: 0, y: 0 };
                
                velocity.x *= Math.abs(velocity.x) > 10 ? 0.8 : damping;
                velocity.y *= Math.abs(velocity.y) > 10 ? 0.8 : damping;

                let x = parseInt(idea.element.style.left) + velocity.x * deltaTime;
                let y = parseInt(idea.element.style.top) + velocity.y * deltaTime;

                if (x < leftBoundary) {
                    x = leftBoundary;
                    velocity.x = -velocity.x;
                }

                if (x > this.workspace.clientWidth - idea.element.clientWidth) {
                    x = this.workspace.clientWidth - idea.element.clientWidth;
                    velocity.x = -velocity.x;
                }
                if (y < 0) {
                    y = 0;
                    velocity.y = -velocity.y;
                }
                if (y > this.workspace.clientHeight - idea.element.clientHeight) {
                    y = this.workspace.clientHeight - idea.element.clientHeight;
                    velocity.y = -velocity.y;
                }

                if (Math.abs(velocity.x) < minSpeed) velocity.x = 0;
                if (Math.abs(velocity.y) < minSpeed) velocity.y = 0;

                requestAnimationFrame(() => {
                    idea.element.style.left = `${x}px`;
                    idea.element.style.top = `${y}px`;
                });
                this.velocities.set(idea, velocity);
            }
        }

        for (let i = 0; i < this.ideas.length; i++) {
            for (let j = i + 1; j < this.ideas.length; j++) {
                const idea1 = this.ideas[i];
                const idea2 = this.ideas[j];

                if (this.isDragging && (idea1.element === this.selectedIdea || idea2.element === this.selectedIdea)) {
                    continue;
                }

                const pos1 = {
                    x: parseInt(idea1.element.style.left),
                    y: parseInt(idea1.element.style.top)
                };
                const pos2 = {
                    x: parseInt(idea2.element.style.left),
                    y: parseInt(idea2.element.style.top)
                };

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = 120;

                if (distance < minDistance) {
                    const angle = Math.atan2(dy, dx);
                    
                    const speed = 30;
                    
                    const newVel1 = {
                        x: -speed * Math.cos(angle) * 0.3,
                        y: -speed * Math.sin(angle) * 0.3
                    };
                    const newVel2 = {
                        x: speed * Math.cos(angle) * 0.3,
                        y: speed * Math.sin(angle) * 0.3
                    };
                    
                    this.velocities.set(idea1, newVel1);
                    this.velocities.set(idea2, newVel2);

                    const overlap = (minDistance - distance) * 0.5;
                    const separationX = (overlap * dx) / distance / 2;
                    const separationY = (overlap * dy) / distance / 2;

                    idea1.element.style.left = `${pos1.x - separationX}px`;
                    idea1.element.style.top = `${pos1.y - separationY}px`;
                    idea2.element.style.left = `${pos2.x + separationX}px`;
                    idea2.element.style.top = `${pos2.y + separationY}px`;
                }
            }
        }

        this.drawConnections();
    }

    setupDragListeners(ideaBall) {
        ideaBall.addEventListener('dragstart', (e) => {
            if (!this.isSelectMode) {
                this.isDragging = true;
                this.selectedIdea = ideaBall;
                const rect = ideaBall.getBoundingClientRect();
                this.dragStartPos = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                const dragImage = document.createElement('div');
                dragImage.style.width = '0';
                dragImage.style.height = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);

                const idea = this.ideas.find(i => i.element === ideaBall);
                this.velocities.set(idea, { x: 0, y: 0 });
            }
        });

        ideaBall.addEventListener('drag', (e) => {
            if (this.isSelectMode || e.clientX === 0 && e.clientY === 0) return;
            
            requestAnimationFrame(() => {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
                const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
                
                const minPadding = 120;
                const boundedX = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
                const boundedY = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
                
                ideaBall.style.left = `${boundedX}px`;
                ideaBall.style.top = `${boundedY}px`;
                this.drawConnections();
            });
        });

        ideaBall.addEventListener('dragend', (e) => {
            if (this.isDragging && this.selectedIdea) {
                const idea = this.ideas.find(i => i.element === this.selectedIdea);
                if (idea) {
                    const lastX = parseInt(this.selectedIdea.style.left);
                    const lastY = parseInt(this.selectedIdea.style.top);
                    const deltaX = lastX - parseInt(this.selectedIdea.style.left);
                    const deltaY = lastY - parseInt(this.selectedIdea.style.top);
                    
                    this.velocities.set(idea, {
                        x: deltaX * 5,
                        y: deltaY * 5
                    });
                    
                    // Update the idea's coordinates for database persistence
                    idea.x = parseFloat(ideaBall.style.left);
                    idea.y = parseFloat(ideaBall.style.top);
                    
                    // Update in database if the idea has an ID
                    if (idea.id) {
                        this.updateIdeaPosition(idea, idea.x, idea.y);
                    }
                }
            }
            this.isDragging = false;
            this.selectedIdea = null;
        });
    }

    drawConnections() {
        const canvas = document.getElementById('connections-canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match workspace size
        canvas.width = this.workspace.scrollWidth;
        canvas.height = this.workspace.scrollHeight;
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw each connection
        this.connections.forEach(conn => {
            // Support both formats and get the ideas for the connection
            const fromIdea = conn.from || conn.source;
            const toIdea = conn.to || conn.target;
            
            if (!fromIdea || !toIdea) {
                console.warn('Invalid connection - missing from/to ideas:', conn);
                return;
            }
            
            if (!fromIdea.element || !toIdea.element) {
                console.warn('Invalid connection - missing DOM elements:', conn);
                return;
            }
            
            // Get element positions
            const fromRect = fromIdea.element.getBoundingClientRect();
            const toRect = toIdea.element.getBoundingClientRect();
            const workspaceRect = this.workspace.getBoundingClientRect();
            
            // Calculate center points with scroll offset
            const fromX = fromRect.left - workspaceRect.left + this.workspace.scrollLeft + fromRect.width/2;
            const fromY = fromRect.top - workspaceRect.top + this.workspace.scrollTop + fromRect.height/2;
            const toX = toRect.left - workspaceRect.left + this.workspace.scrollLeft + toRect.width/2;
            const toY = toRect.top - workspaceRect.top + this.workspace.scrollTop + toRect.height/2;
            
            // Set line style based on pending status
            if (conn.pending) {
                // Dashed line for pending connections
                ctx.setLineDash([5, 3]);
                ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
            } else {
                // Solid line for saved connections
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            }
            
            // Draw connection line
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            // Add a subtle glow effect
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            // Reset line dash for other operations
            ctx.setLineDash([]);
            
            // Draw arrow indicator
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const arrowLength = 8;
            const arrowWidth = 4;
            
            // Arrow endpoint is a bit before the actual endpoint
            const endX = toX - 10 * Math.cos(angle);
            const endY = toY - 10 * Math.sin(angle);
            
            // Draw arrow head
            ctx.fillStyle = conn.pending ? 'rgba(255, 200, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowLength * Math.cos(angle - Math.PI/arrowWidth),
                endY - arrowLength * Math.sin(angle - Math.PI/arrowWidth)
            );
            ctx.lineTo(
                endX - arrowLength * Math.cos(angle + Math.PI/arrowWidth),
                endY - arrowLength * Math.sin(angle + Math.PI/arrowWidth)
            );
            ctx.closePath();
            ctx.fill();
        });
    }

    setupProjectEventListeners() {
        // Listen for the load-ideas event
        document.addEventListener('load-ideas', (e) => {
            const ideas = e.detail.ideas;
            if (ideas && ideas.length > 0) {
                this.loadIdeasFromDatabase(ideas);
            }
        });
        
        // Listen for the clear-workspace event
        document.addEventListener('clear-workspace', () => {
            this.clearWorkspace();
        });
        
        // Listen for project-selected event
        document.addEventListener('project-selected', (e) => {
            const projectId = e.detail.projectId;
            if (projectId) {
                // Update current project ID
                this.currentProjectId = projectId;
                
                // Update the history panel to show only this project's history
                this.updateHistoryPanel();
                
                console.log(`Switched to project ID: ${projectId}`);
            }
        });
    }
    
    loadIdeasFromDatabase(ideas) {
        // Clear existing ideas first
        this.clearWorkspace();
        
        // Get the current project ID
        this.currentProjectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        
        if (!this.currentProjectId) {
            console.warn('Cannot load ideas: No project selected');
            return;
        }
        
        // Store idea IDs for reference
        const loadedIdeasById = new Map();
        
        // Add each idea from the database
        ideas.forEach(idea => {
            const newIdea = this.addIdeaFromDatabase(
                idea.x_position, 
                idea.y_position, 
                idea.text,
                idea.id
            );
            
            // Store the idea by ID for connection reference
            if (newIdea && idea.id) {
                loadedIdeasById.set(idea.id, newIdea);
            }
        });

        // After all ideas are loaded, now load connections
        this.loadConnectionsFromDatabase(loadedIdeasById);
        
        // Update history panel for this project
        this.updateHistoryPanel();
    }
    
    addIdeaFromDatabase(x, y, text, id) {
        // Create idea element using the existing addIdea method
        const idea = this.addIdea(x, y, text, false, false, true); // skipSave = true
        
        // Set the database ID
        if (idea) {
            idea.id = id;
            console.log(`Added idea from database with ID ${id}:`, idea); // Debug log
            
            // Add to project history when loaded from database
            this.addToHistory(text, this.currentProjectId);
        }
        
        return idea;
    }

    addIdea(x, y, text, isAIGenerated = false, isCombined = false, skipSave = false) {
        // Create the idea with existing functionality
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'} ${isCombined ? 'combined' : ''}`;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
        // Set default rating to 0
        ideaBall.dataset.rating = "0";
        
        const textContainer = document.createElement('div');
        textContainer.className = 'idea-ball-inner';
        textContainer.innerHTML = `<p class='idea-ball-text'>${text}</p>`;
        ideaBall.appendChild(textContainer);
        
        // Ensure draggable is set
        ideaBall.draggable = true;

        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm generate-btn idea-button';
        generateBtn.innerHTML = '+';
        generateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleGenerateClick(ideaBall, text);
        });
        ideaBall.appendChild(generateBtn);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn btn-sm info-btn idea-button';
        infoBtn.innerHTML = 'i';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTooltip(ideaBall, text);
        });
        ideaBall.appendChild(infoBtn);

        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn btn-sm merge-btn idea-button';
        mergeBtn.innerHTML = '⚡';
        mergeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleMergeMode(ideaBall);
        });
        ideaBall.appendChild(mergeBtn);

        const rateBtn = document.createElement('button');
        rateBtn.className = 'btn btn-sm rate-btn idea-button';
        rateBtn.innerHTML = '⭐';
        rateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRatingInterface(ideaBall);
        });
        ideaBall.appendChild(rateBtn);

        const ratingDisplay = document.createElement('div');
        ratingDisplay.className = 'idea-rating';
        ideaBall.appendChild(ratingDisplay);

        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text, x: x, y: y };
        this.ideas.push(idea);
        this.addToHistory(text);
        
        // Save to database if a project is selected and skipSave is false
        if (!skipSave) {
            this.saveIdeaToDatabase(idea)
                .then(savedIdea => {
                    if (savedIdea) {
                        idea.id = savedIdea.id; // Update with the ID from the database
                        console.log(`Saved idea to database, assigned ID ${savedIdea.id}:`, idea); // Debug log
                        
                        // Check if there are any pending connections for this idea
                        this.retryPendingConnections();
                    }
                });
        }
        
        return idea;
    }
    
    async saveIdeaToDatabase(idea) {
        // Get the current project ID
        const projectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        
        if (!projectId) {
            console.warn('Not saving idea to database: No project selected');
            return null;
        }
        
        try {
            const response = await fetch('/save-idea', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: idea.text,
                    project_id: projectId,
                    x_position: parseFloat(idea.element.style.left),
                    y_position: parseFloat(idea.element.style.top)
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                idea.id = data.idea.id; // Update with the ID from the database
                return data.idea;
            } else {
                console.error('Failed to save idea:', data.error);
                return null;
            }
        } catch (error) {
            console.error('Error saving idea:', error);
            return null;
        }
    }

    async handleGenerateClick(ideaBall, text) {
        try {
            ideaBall.classList.add('generating');
            
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: text })
            });

            const data = await response.json();
            ideaBall.classList.remove('generating');
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 150;
                
                const idea = this.ideas.find(i => i.element === ideaBall);
                relatedIdeas.forEach((relatedIdea, index) => {
                    const angle = (2 * Math.PI * index) / relatedIdeas.length;
                    const x = parseInt(ideaBall.style.left) + radius * Math.cos(angle);
                    const y = parseInt(ideaBall.style.top) + radius * Math.sin(angle);
                    
                    const newIdea = this.addIdea(x, y, relatedIdea.text, true);
                    this.connectIdeas(idea, newIdea);
                });
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
            ideaBall.classList.remove('generating');
        }
    }

    async handleMergeMode(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        const ideaIndex = this.mergeIdeas.indexOf(idea);
        
        if (ideaIndex === -1) {
            if (this.mergeIdeas.length < 2) {
                this.mergeIdeas.push(idea);
                ideaBall.classList.add('merge-mode');
            }
        } else {
            this.mergeIdeas.splice(ideaIndex, 1);
            ideaBall.classList.remove('merge-mode');
        }
        
        if (this.mergeIdeas.length === 2) {
            this.handleMerge();
        }
    }

    async handleMerge() {
        if (this.mergeIdeas.length !== 2) return;
        
        const idea1 = this.mergeIdeas[0];
        const idea2 = this.mergeIdeas[1];
        
        try {
            idea1.element.classList.add('generating');
            idea2.element.classList.add('generating');
            
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idea: `Combine these two ideas: 1. ${idea1.text} 2. ${idea2.text}`
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const combinedIdeas = JSON.parse(data.data).ideas;
                const x1 = parseInt(idea1.element.style.left);
                const y1 = parseInt(idea1.element.style.top);
                const x2 = parseInt(idea2.element.style.left);
                const y2 = parseInt(idea2.element.style.top);
                
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                
                // Create the new combined idea
                const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text, false, true);
                
                // We need to wait for the new idea to get an ID before connecting it
                // The connectIdeas method now handles pending connections internally
                this.connectIdeas(idea1, newIdea);
                this.connectIdeas(idea2, newIdea);
                
                console.log('Created new combined idea:', newIdea);
            }
        } catch (error) {
            console.error('Error merging ideas:', error);
        } finally {
            // Clean up
            idea1.element.classList.remove('generating', 'merge-mode');
            idea2.element.classList.remove('generating', 'merge-mode');
            this.mergeIdeas = [];
        }
    }

    connectIdeas(idea1, idea2) {
        // First, check if both ideas have IDs (necessary for database persistence)
        if (!idea1.id || !idea2.id) {
            console.warn('Cannot connect ideas: One or both ideas missing database ID');
            console.log('Idea 1:', idea1);
            console.log('Idea 2:', idea2);
            
            // Add to connections array for visual representation only
            this.connections.push({ 
                from: idea1, 
                to: idea2, 
                source: idea1, 
                target: idea2,
                pending: true // Mark as pending database save
            });
            this.drawConnections();
            
            // Schedule a retry after a short delay
            setTimeout(() => {
                this.retryPendingConnections();
            }, 1000);
            
            return;
        }
        
        // Both ideas have IDs, so we can save the connection
        this.saveConnectionToDatabase(idea1.id, idea2.id).then(connection => {
            if (connection) {
                // Add to connections array with the database ID
                this.connections.push({
                    from: idea1,
                    to: idea2,
                    source: idea1,
                    target: idea2,
                    id: connection.id
                });
                this.drawConnections();
            }
        });
    }

    clearWorkspace() {
        // Remove all idea elements from the DOM
        this.ideas.forEach(idea => {
            if (idea.element && idea.element.parentNode) {
                idea.element.parentNode.removeChild(idea.element);
            }
        });
        
        // Clear the arrays
        this.ideas = [];
        this.connections = [];
        
        // Clear any tooltips or other UI elements
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }
        
        // Clear any merge state
        this.mergeIdeas = [];
        this.selectedIdeas = [];
        this.isSelectMode = false;
        
        // Note: We don't clear idea history when clearing workspace
        // because history is now project-specific and persistent
        
        // Redraw the (now empty) connections
        this.drawConnections();
        
        console.log('Workspace cleared');
    }

    addToHistory(text, projectId = null) {
        // Use current project ID if none provided
        const targetProjectId = projectId || this.currentProjectId || (window.projectManager ? window.projectManager.getCurrentProjectId() : null);
        
        if (!targetProjectId) {
            console.warn('Cannot add to history: No project selected');
            return;
        }
        
        // Initialize history array for this project if it doesn't exist
        if (!this.ideaHistoryByProject.has(targetProjectId)) {
            this.ideaHistoryByProject.set(targetProjectId, []);
        }
        
        // Get project history
        const projectHistory = this.ideaHistoryByProject.get(targetProjectId);
        
        // Add idea to project history
        if (text && text.trim() !== '') {
            // Skip if already in history
            if (projectHistory.includes(text)) {
                return;
            }
            
            // Add to beginning of history
            projectHistory.unshift(text);
            
            // Limit history size
            if (projectHistory.length > this.maxHistoryItems) {
                projectHistory.pop();
            }
            
            // Update UI if this is the current project
            if (targetProjectId === this.currentProjectId) {
                this.updateHistoryPanel();
            }
        }
    }

    // New method to update the history panel based on current project
    updateHistoryPanel() {
        if (!this.ideasList) return;
        
        // Clear the current list
        this.ideasList.innerHTML = '';
        
        // Get current project history
        const currentProjectHistory = this.ideaHistoryByProject.get(this.currentProjectId) || [];
        
        // Add each idea to the history panel
        currentProjectHistory.forEach(idea => {
            const li = document.createElement('li');
            li.textContent = idea.length > 70 ? idea.substring(0, 70) + '...' : idea;
            li.dataset.fullText = idea;
            li.addEventListener('click', () => {
                const rect = this.workspace.getBoundingClientRect();
                const x = rect.width / 2;
                const y = rect.height / 2;
                this.addIdea(x, y, idea);
            });
            this.ideasList.appendChild(li);
        });
    }

    showTooltip(ideaBall, text) {
        // If there's an active tooltip and we're clicking the same idea ball
        if (this.activeTooltip && this.activeTooltip._parentIdeaBall === ideaBall) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
            return;
        }

        // Remove any existing tooltip
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        // Create and show new tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        tooltip.style.position = 'absolute';
        tooltip.style.left = '120%';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translateY(-50%)';
        
        // Store reference to parent idea ball
        tooltip._parentIdeaBall = ideaBall;
        
        ideaBall.appendChild(tooltip);
        this.activeTooltip = tooltip;
    }

    setupHistoryToggle() {
        const toggleBtn = document.getElementById('toggleHistory');
        const historyContent = document.getElementById('historyContent');
        
        if (!toggleBtn || !historyContent) return;
        
        toggleBtn.addEventListener('click', () => {
            historyContent.classList.toggle('hidden');
            toggleBtn.textContent = historyContent.classList.contains('hidden') ? 'Show History' : 'Hide History';
        });
        
        // Initial history update for current project
        this.currentProjectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        if (this.currentProjectId) {
            this.updateHistoryPanel();
        }
    }

    setupRatingSystem() {
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                const rating = parseInt(e.target.dataset.rating);
                this.setRating(rating);
            });
        });
    }

    setRating(rating) {
        this.currentRating = rating;
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            star.classList.toggle('active', starRating <= rating);
        });
    }

    resetModal() {
        document.getElementById('ideaInput').value = '';
        this.setRating(0);
    }

    createIdeaBall(text, x, y) {
        const ideaBall = document.createElement('div');
        ideaBall.className = 'idea-ball';
        
        const innerBall = document.createElement('div');
        innerBall.className = 'idea-ball-inner';
        
        const textElement = document.createElement('p');
        textElement.className = 'idea-ball-text';
        textElement.textContent = text;
        
        // Add rating button
        const rateBtn = document.createElement('button');
        rateBtn.className = 'btn idea-button rate-btn';
        rateBtn.innerHTML = '⭐';
        rateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRatingInterface(ideaBall);
        });

        // Add rating display
        const ratingDisplay = document.createElement('div');
        ratingDisplay.className = 'idea-rating';
        ideaBall.dataset.rating = '0';
        
        innerBall.appendChild(textElement);
        ideaBall.appendChild(innerBall);
        ideaBall.appendChild(rateBtn);
        ideaBall.appendChild(ratingDisplay);
        
        // ... rest of your existing ideaBall setup code ...
        
        return ideaBall;
    }

    showRatingInterface(ideaBall) {
        const currentRating = parseInt(ideaBall.dataset.rating) || 0;
        const previousRating = currentRating;
        
        // Create rating interface
        const ratingInterface = document.createElement('div');
        ratingInterface.className = 'star-rating';
        ratingInterface.style.position = 'absolute';
        ratingInterface.style.bottom = '-30px';
        ratingInterface.style.left = '50%';
        ratingInterface.style.transform = 'translateX(-50%)';
        ratingInterface.style.background = 'rgba(0, 0, 0, 0.8)';
        ratingInterface.style.padding = '5px 10px';
        ratingInterface.style.borderRadius = '15px';
        ratingInterface.style.whiteSpace = 'nowrap';
        ratingInterface.style.display = 'flex';
        ratingInterface.style.alignItems = 'center';
        ratingInterface.style.gap = '10px';
        
        // Create stars container
        const starsContainer = document.createElement('div');
        starsContainer.style.display = 'flex';
        starsContainer.style.gap = '5px';
        
        // Create zero-star option (outlined star)
        const zeroStar = document.createElement('span');
        zeroStar.className = 'star' + (currentRating === 0 ? ' active' : '');
        zeroStar.textContent = '☆';  // Outlined star
        zeroStar.style.cursor = 'pointer';
        zeroStar.title = 'Reset to default';
        zeroStar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setRating(ideaBall, 0);
            ratingInterface.remove();
        });
        starsContainer.appendChild(zeroStar);
        
        // Create stars (1-3)
        const titles = ['Bronze', 'Silver', 'Gold'];
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement('span');
            star.className = 'star' + (i <= currentRating ? ' active' : '');
            star.textContent = '⭐';
            star.style.cursor = 'pointer';
            star.title = titles[i-1];
            
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setRating(ideaBall, i);
                ratingInterface.remove();
            });
            
            starsContainer.appendChild(star);
        }
        
        // Add undo button
        const undoButton = document.createElement('button');
        undoButton.className = 'btn btn-sm btn-outline-secondary';
        undoButton.innerHTML = '↩️';
        undoButton.style.padding = '0px 5px';
        undoButton.style.fontSize = '12px';
        undoButton.title = 'Undo previous rating';
        
        undoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setRating(ideaBall, previousRating);
            ratingInterface.remove();
        });
        
        // Remove existing rating interface if any
        const existingInterface = ideaBall.querySelector('.star-rating');
        if (existingInterface) {
            existingInterface.remove();
        }
        
        // Append everything to the rating interface
        ratingInterface.appendChild(starsContainer);
        ratingInterface.appendChild(undoButton);
        ideaBall.appendChild(ratingInterface);
    }

    setRating(ideaBall, rating) {
        ideaBall.dataset.rating = rating;
        
        // Center the text within the potentially resized ball
        const textContainer = ideaBall.querySelector('.idea-ball-inner');
        if (textContainer) {
            textContainer.style.width = '100%';
            textContainer.style.height = '100%';
            textContainer.style.display = 'flex';
            textContainer.style.alignItems = 'center';
            textContainer.style.justifyContent = 'center';
        }
    }

    saveIdea() {
        const ideaInput = document.getElementById('ideaInput');
        const text = ideaInput.value.trim();
        
        if (text) {
            const ideaBall = this.createIdeaBall(text, this.lastClickX, this.lastClickY);
            this.workspace.appendChild(ideaBall);
            this.ideaModal.hide();
            this.resetModal();
            
            // Add to history with rating
            this.addToHistory(text);
        }
    }

    async updateIdeaPosition(idea, x, y) {
        // Get the current project ID
        const projectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        
        if (!projectId || !idea.id) {
            console.warn('Cannot update idea position: No project selected or idea has no ID');
            return null;
        }
        
        try {
            const response = await fetch('/update-idea-position', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: idea.id,
                    project_id: projectId,
                    x_position: x,
                    y_position: y
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('Failed to update idea position:', data.error);
            }
        } catch (error) {
            console.error('Error updating idea position:', error);
        }
    }

    async loadConnectionsFromDatabase(loadedIdeasById) {
        const projectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        
        if (!projectId) {
            console.warn('Cannot load connections: No project selected');
            return;
        }
        
        try {
            const response = await fetch(`/get-connections?project_id=${projectId}`);
            const data = await response.json();
            
            console.log('Loaded connections data:', data); // Debug log
            
            if (data.success) {
                // Reset connections
                this.connections = [];
                
                // Process each connection
                data.connections.forEach(connection => {
                    const sourceId = connection.source_id;
                    const targetId = connection.target_id;
                    
                    // Look up the ideas by their IDs
                    const sourceIdea = loadedIdeasById.get(sourceId);
                    const targetIdea = loadedIdeasById.get(targetId);
                    
                    if (sourceIdea && targetIdea) {
                        console.log(`Creating connection between ideas ${sourceId} and ${targetId}`); // Debug log
                        
                        // Add to connections array using both naming formats for compatibility
                        this.connections.push({
                            from: sourceIdea,
                            to: targetIdea,
                            source: sourceIdea,
                            target: targetIdea,
                            id: connection.id
                        });
                    } else {
                        console.warn(`Cannot create connection: Source or target idea not found. Source ID: ${sourceId}, Target ID: ${targetId}`);
                    }
                });
                
                // Redraw all connections
                this.drawConnections();
            } else {
                console.error('Failed to load connections:', data.error);
            }
        } catch (error) {
            console.error('Error loading connections:', error);
        }
    }

    async saveConnectionToDatabase(sourceId, targetId) {
        const projectId = window.projectManager ? window.projectManager.getCurrentProjectId() : null;
        
        if (!projectId) {
            console.warn('Cannot save connection: No project selected');
            return null;
        }
        
        console.log(`Saving connection from idea ${sourceId} to idea ${targetId}`); // Debug log
        
        try {
            const response = await fetch('/save-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source_id: sourceId,
                    target_id: targetId,
                    project_id: projectId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('Connection saved successfully:', data.connection); // Debug log
                return data.connection;
            } else {
                console.error('Failed to save connection:', data.error);
                return null;
            }
        } catch (error) {
            console.error('Error saving connection:', error);
            return null;
        }
    }

    // Add a method to retry saving pending connections
    retryPendingConnections() {
        const pendingConnections = this.connections.filter(conn => conn.pending);
        
        pendingConnections.forEach((conn, index) => {
            const idea1 = conn.from || conn.source;
            const idea2 = conn.to || conn.target;
            
            if (idea1.id && idea2.id) {
                // Now both ideas have IDs, so we can save the connection
                this.saveConnectionToDatabase(idea1.id, idea2.id).then(connection => {
                    if (connection) {
                        // Update the pending connection with the database ID
                        conn.id = connection.id;
                        conn.pending = false;
                    }
                });
            }
        });
    }
}
