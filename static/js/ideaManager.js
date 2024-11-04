class IdeaManager {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
        this.ideas = [];
        this.connections = [];
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.selectedIdea = null;
        this.setupEventListeners();
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
            this.isDragging = true;
            this.selectedIdea = ideaBall;
            const rect = ideaBall.getBoundingClientRect();
            this.dragStartPos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            e.dataTransfer.setDragImage(ideaBall, this.dragStartPos.x, this.dragStartPos.y);
        });

        ideaBall.addEventListener('drag', (e) => {
            if (e.clientX === 0 && e.clientY === 0) return;
            
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
            const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
            
            ideaBall.style.left = `${x}px`;
            ideaBall.style.top = `${y}px`;
            
            this.updateConnections();
        });

        ideaBall.addEventListener('dragend', () => {
            this.isDragging = false;
            this.selectedIdea = null;
            this.updateConnections();
        });

        // Show full text on click
        ideaBall.addEventListener('click', (e) => {
            if (e.target !== generateBtn) {
                e.stopPropagation();
                this.showTooltip(ideaBall, text);
            }
        });

        return ideaBall;
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

    addIdea(x, y, text, isAIGenerated = false) {
        const ideaBall = this.createIdeaBall(x, y, text, isAIGenerated);
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text, isAIGenerated };
        this.ideas.push(idea);
        
        // Add click handler for the generate button
        const generateBtn = ideaBall.querySelector('.generate-btn');
        generateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
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
                    const radius = 200;
                    const angleStep = (2 * Math.PI) / relatedIdeas.length;

                    relatedIdeas.forEach((newIdea, index) => {
                        const angle = index * angleStep;
                        const newX = parseInt(ideaBall.style.left) + radius * Math.cos(angle);
                        const newY = parseInt(ideaBall.style.top) + radius * Math.sin(angle);
                        
                        console.log('Creating related idea:', { text: newIdea.text, x: newX, y: newY });
                        const subIdea = this.addIdea(newX, newY, newIdea.text, true);
                        this.connectIdeas(idea, subIdea);
                    });

                    this.centerOnPoint(parseInt(ideaBall.style.left), parseInt(ideaBall.style.top));
                }
            } catch (error) {
                console.error('Error generating ideas:', error);
            }
        });
        
        this.centerOnPoint(x, y);
        return idea;
    }

    connectIdeas(idea1, idea2) {
        const line = this.createConnectionLine(idea1.element, idea2.element);
        this.workspace.insertBefore(line, this.workspace.firstChild);
        this.connections.push({ line, from: idea1.element, to: idea2.element });
    }

    handleWorkspaceClick(x, y) {
        if (!this.isDragging) {
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
    }
}