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
        this.setupEventListeners();
    }

    checkCollision(x, y, existingIdeas) {
        const radius = 70; // Ball radius + padding
        for (const idea of existingIdeas) {
            const ideaX = parseInt(idea.element.style.left);
            const ideaY = parseInt(idea.element.style.top);
            const distance = Math.sqrt(Math.pow(x - ideaX, 2) + Math.pow(y - ideaY, 2));
            if (distance < radius * 2) return true;
        }
        return false;
    }

    findValidPosition(x, y) {
        const minPadding = 120;
        const maxAttempts = 10;
        const spiralStep = 100;
        
        // Ensure coordinates are positive and within bounds
        x = Math.max(minPadding, x);
        y = Math.max(minPadding, y);
        
        // Also ensure they don't exceed workspace bounds
        const maxX = this.workspace.clientWidth - minPadding;
        const maxY = this.workspace.clientHeight - minPadding;
        x = Math.min(x, maxX);
        y = Math.min(y, maxY);
        
        if (!this.checkCollision(x, y, this.ideas)) return { x, y };
        
        // Try positions in a spiral pattern
        for (let i = 1; i <= maxAttempts; i++) {
            const angle = i * (Math.PI / 4);
            const newX = x + Math.cos(angle) * (spiralStep * i);
            const newY = y + Math.sin(angle) * (spiralStep * i);
            
            // Ensure spiral positions are also within bounds
            const boundedX = Math.max(minPadding, Math.min(newX, maxX));
            const boundedY = Math.max(minPadding, Math.min(newY, maxY));
            
            if (!this.checkCollision(boundedX, boundedY, this.ideas)) {
                return { x: boundedX, y: boundedY };
            }
        }
        
        return { x, y }; // Return bounded position if no valid position found
    }

    setupEventListeners() {
        this.workspace.addEventListener('click', (e) => {
            if (e.target === this.workspace) {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX + this.workspace.scrollLeft - rect.left;
                const y = e.clientY + this.workspace.scrollTop - rect.top;
                this.handleWorkspaceClick(x, y);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.workspace.contains(e.target)) {
                this.hideAllTooltips();
            }
        });
    }

    createIdeaBall(x, y, text, isAIGenerated = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'}`;
        const shortText = text.length > 15 ? text.substring(0, 15) + '...' : text;
        ideaBall.textContent = shortText;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
        // Add generate button
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm btn-secondary generate-btn';
        generateBtn.textContent = '+';
        generateBtn.style.position = 'absolute';
        generateBtn.style.right = '-10px';
        generateBtn.style.top = '-10px';
        ideaBall.appendChild(generateBtn);
        
        // Setup dragging
        ideaBall.setAttribute('draggable', 'true');
        
        ideaBall.addEventListener('dragstart', (e) => {
            if (!this.isSelectMode) {
                this.isDragging = true;
                this.selectedIdea = ideaBall;
                const rect = ideaBall.getBoundingClientRect();
                this.dragStartPos = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                e.dataTransfer.setDragImage(ideaBall, this.dragStartPos.x, this.dragStartPos.y);
            }
        });

        ideaBall.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
            if (this.isSelectMode) return;
            
            const rect = this.workspace.getBoundingClientRect();
            const scrollLeft = this.workspace.scrollLeft;
            const scrollTop = this.workspace.scrollTop;
            
            // Calculate new position ensuring it's positive
            const x = Math.max(0, e.clientX - rect.left + scrollLeft);
            const y = Math.max(0, e.clientY - rect.top + scrollTop);
            
            // Find valid position within bounds
            const position = this.findValidPosition(x, y);
            
            // Update position with animation frame for smoother movement
            requestAnimationFrame(() => {
                ideaBall.style.left = `${position.x}px`;
                ideaBall.style.top = `${position.y}px`;
                this.updateConnections();
            });
        });

        ideaBall.addEventListener('dragend', () => {
            if (this.isDragging && this.selectedIdea) {
                const currentX = parseInt(ideaBall.style.left);
                const currentY = parseInt(ideaBall.style.top);
                const position = this.findValidPosition(currentX, currentY);
                
                ideaBall.style.left = `${position.x}px`;
                ideaBall.style.top = `${position.y}px`;
                this.updateConnections();
            }
            this.isDragging = false;
            this.selectedIdea = null;
        });

        ideaBall.addEventListener('click', (e) => {
            if (e.target === generateBtn) {
                e.stopPropagation();
                this.handleGenerateClick(ideaBall, text);
            } else if (this.isSelectMode) {
                e.stopPropagation();
                this.handleIdeaSelection(ideaBall);
            } else {
                e.stopPropagation();
                this.showTooltip(ideaBall, text);
            }
        });

        return ideaBall;
    }

    handleIdeaSelection(ideaBall) {
        const ideaIndex = this.selectedIdeas.findIndex(idea => idea.element === ideaBall);
        if (ideaIndex === -1) {
            if (this.selectedIdeas.length < 2) {
                ideaBall.classList.add('selected');
                const idea = this.ideas.find(i => i.element === ideaBall);
                this.selectedIdeas.push(idea);
            }
        } else {
            ideaBall.classList.remove('selected');
            this.selectedIdeas.splice(ideaIndex, 1);
        }
    }

    async handleGenerateClick(ideaBall, text) {
        try {
            console.log('Sending request to generate ideas for:', text);
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: text })
            });

            const data = await response.json();
            console.log('Received response:', data);
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = Math.min(200, (this.workspace.clientWidth - parseInt(ideaBall.style.left) - 240) / 2);
                const angleStep = (2 * Math.PI) / relatedIdeas.length;

                relatedIdeas.forEach((newIdea, index) => {
                    const baseAngle = index * angleStep;
                    const baseX = parseInt(ideaBall.style.left) + radius * Math.cos(baseAngle);
                    const baseY = parseInt(ideaBall.style.top) + radius * Math.sin(baseAngle);
                    const position = this.findValidPosition(baseX, baseY);
                    const subIdea = this.addIdea(position.x, position.y, newIdea.text, true);
                    this.connectIdeas(this.ideas.find(i => i.element === ideaBall), subIdea);
                });

                this.centerOnPoint(parseInt(ideaBall.style.left), parseInt(ideaBall.style.top));
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
        }
    }

    addIdea(x, y, text, isAIGenerated = false) {
        const position = this.findValidPosition(x, y);
        const ideaBall = this.createIdeaBall(position.x, position.y, text, isAIGenerated);
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text, isAIGenerated };
        this.ideas.push(idea);
        this.centerOnPoint(position.x, position.y);
        return idea;
    }

    enterSelectMode() {
        this.isSelectMode = true;
        this.selectedIdeas = [];
        this.workspace.style.cursor = 'pointer';
    }

    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedIdeas.forEach(idea => idea.element.classList.remove('selected'));
        this.selectedIdeas = [];
        this.workspace.style.cursor = 'default';
    }

    createConnectionLine(from, to) {
        const line = document.createElement('div');
        line.className = 'connection-line';
        this.updateConnectionPosition(line, from, to);
        return line;
    }

    updateConnectionPosition(line, from, to) {
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const workspaceRect = this.workspace.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - workspaceRect.left + this.workspace.scrollLeft;
        const fromY = fromRect.top + fromRect.height / 2 - workspaceRect.top + this.workspace.scrollTop;
        const toX = toRect.left + toRect.width / 2 - workspaceRect.left + this.workspace.scrollLeft;
        const toY = toRect.top + toRect.height / 2 - workspaceRect.top + this.workspace.scrollTop;

        const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        const angle = Math.atan2(toY - fromY, toX - fromX);

        line.style.width = `${length}px`;
        line.style.left = `${fromX}px`;
        line.style.top = `${fromY}px`;
        line.style.transform = `rotate(${angle}rad)`;
    }

    updateConnections() {
        this.connections.forEach(conn => {
            this.updateConnectionPosition(conn.line, conn.from, conn.to);
        });
    }

    connectIdeas(idea1, idea2) {
        const line = this.createConnectionLine(idea1.element, idea2.element);
        this.workspace.insertBefore(line, this.workspace.firstChild);
        this.connections.push({ line, from: idea1.element, to: idea2.element });
    }

    handleWorkspaceClick(x, y) {
        if (!this.isDragging && !this.isSelectMode) {
            console.log('Dispatching workspace-click event:', { x, y });
            const event = new CustomEvent('workspace-click', {
                detail: { x, y }
            });
            document.dispatchEvent(event);
        }
    }

    centerOnPoint(x, y) {
        this.workspace.scrollTo({
            left: x - this.workspace.clientWidth / 2,
            top: y - this.workspace.clientHeight / 2,
            behavior: 'smooth'
        });
    }

    showTooltip(element, text) {
        this.hideAllTooltips();
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        tooltip.style.position = 'absolute';
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top}px`;
        
        document.body.appendChild(tooltip);
    }

    hideAllTooltips() {
        document.querySelectorAll('.idea-tooltip').forEach(tooltip => tooltip.remove());
    }

    clearWorkspace() {
        this.workspace.innerHTML = '';
        this.ideas = [];
        this.connections = [];
        this.exitSelectMode();
    }
}
