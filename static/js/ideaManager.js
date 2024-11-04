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
        this.setupEventListeners();
    }

    addToHistory(text, isGenerated = true) {
        if (isGenerated) {
            this.generatedIdeas.unshift(text);
            if (this.generatedIdeas.length > this.maxHistoryItems) {
                this.generatedIdeas.pop();
            }
            this.updateHistoryList();
        }
    }

    updateHistoryList() {
        const list = document.getElementById('ideas-list');
        list.innerHTML = '';
        this.generatedIdeas.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
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
        
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm btn-secondary generate-btn';
        generateBtn.textContent = '+';
        generateBtn.style.position = 'absolute';
        generateBtn.style.right = '-10px';
        generateBtn.style.top = '-10px';
        ideaBall.appendChild(generateBtn);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn btn-sm btn-info info-btn';
        infoBtn.innerHTML = '<i>i</i>';
        infoBtn.style.position = 'absolute';
        infoBtn.style.left = '-10px';
        infoBtn.style.top = '-10px';
        ideaBall.appendChild(infoBtn);

        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn btn-sm btn-warning merge-btn';
        mergeBtn.innerHTML = '⚡';
        mergeBtn.style.position = 'absolute';
        mergeBtn.style.right = '-10px';
        mergeBtn.style.bottom = '-10px';
        ideaBall.appendChild(mergeBtn);
        
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
                const dragImage = document.createElement('div');
                dragImage.style.width = '0';
                dragImage.style.height = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            }
        });

        ideaBall.addEventListener('drag', (e) => {
            if (this.isSelectMode || e.clientX === 0 && e.clientY === 0) return;
            
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
            const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
            
            const minPadding = 120;
            const boundedX = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
            const boundedY = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
            
            ideaBall.style.transform = 'translate(0, 0)';
            ideaBall.style.left = `${boundedX}px`;
            ideaBall.style.top = `${boundedY}px`;
            
            this.updateConnections();
        });

        ideaBall.addEventListener('dragend', () => {
            this.isDragging = false;
            this.selectedIdea = null;
            this.updateConnections();
        });

        ideaBall.addEventListener('click', (e) => {
            if (e.target === generateBtn || e.target === infoBtn || e.target === mergeBtn) {
                e.stopPropagation();
                if (e.target === generateBtn) {
                    this.handleGenerateClick(ideaBall, text);
                } else if (e.target === infoBtn) {
                    this.showTooltip(ideaBall, text);
                } else if (e.target === mergeBtn) {
                    this.handleMergeMode(ideaBall);
                }
            } else if (this.isSelectMode) {
                e.stopPropagation();
                this.handleIdeaSelection(ideaBall);
            }
        });

        return ideaBall;
    }

    handleMergeMode(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        const ideaIndex = this.mergeIdeas.indexOf(idea);
        
        if (ideaIndex === -1) {
            if (this.mergeIdeas.length < 2) {
                ideaBall.classList.add('merge-mode');
                this.mergeIdeas.push(idea);
                
                if (this.mergeIdeas.length === 2) {
                    this.mergeIdeas.forEach(idea => idea.element.classList.add('generating'));
                    this.generateCombinedIdea();
                }
            }
        } else {
            ideaBall.classList.remove('merge-mode');
            this.mergeIdeas.splice(ideaIndex, 1);
        }
    }

    async generateCombinedIdea() {
        const idea1 = this.mergeIdeas[0];
        const idea2 = this.mergeIdeas[1];
        
        try {
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
                
                const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text);
                this.connectIdeas(idea1, newIdea);
                this.connectIdeas(idea2, newIdea);
                this.addToHistory(combinedIdeas[0].text);
            }
        } finally {
            this.mergeIdeas.forEach(idea => {
                idea.element.classList.remove('merge-mode');
                idea.element.classList.remove('generating');
            });
            this.mergeIdeas = [];
        }
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
            ideaBall.classList.add('generating');
            
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
            
            ideaBall.classList.remove('generating');
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = Math.min(200, (this.workspace.clientWidth - parseInt(ideaBall.style.left) - 240) / 2);
                const angleStep = (2 * Math.PI) / relatedIdeas.length;

                relatedIdeas.forEach((newIdea, index) => {
                    const angle = index * angleStep;
                    const newX = Math.max(120, Math.min(
                        parseInt(ideaBall.style.left) + radius * Math.cos(angle),
                        this.workspace.clientWidth - 120
                    ));
                    const newY = Math.max(120, Math.min(
                        parseInt(ideaBall.style.top) + radius * Math.sin(angle),
                        this.workspace.clientHeight - 120
                    ));
                    
                    console.log('Creating related idea:', { text: newIdea.text, x: newX, y: newY });
                    const subIdea = this.addIdea(newX, newY, newIdea.text, true);
                    this.connectIdeas(this.ideas.find(i => i.element === ideaBall), subIdea);
                    this.addToHistory(newIdea.text);
                });

                this.centerOnPoint(parseInt(ideaBall.style.left), parseInt(ideaBall.style.top));
            }
        } catch (error) {
            ideaBall.classList.remove('generating');
            console.error('Error generating ideas:', error);
        }
    }

    addIdea(x, y, text, isAIGenerated = false) {
        const minPadding = 120;
        x = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
        y = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
        
        const ideaBall = this.createIdeaBall(x, y, text, isAIGenerated);
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text, isAIGenerated };
        this.ideas.push(idea);
        this.centerOnPoint(x, y);
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
        if (this.activeTooltip && this.activeTooltip.parentElement === element) {
            this.hideAllTooltips();
            this.activeTooltip = null;
            return;
        }

        this.hideAllTooltips();

        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        
        element.appendChild(tooltip);
        this.activeTooltip = tooltip;
    }

    hideAllTooltips() {
        document.querySelectorAll('.idea-tooltip').forEach(tooltip => tooltip.remove());
        this.activeTooltip = null;
    }

    clearWorkspace() {
        this.workspace.innerHTML = '';
        this.ideas = [];
        this.connections = [];
        this.exitSelectMode();
        this.generatedIdeas = [];
        this.updateHistoryList();
    }
}
