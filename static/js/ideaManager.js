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

        // Handle clicks outside workspace to close tooltips
        document.addEventListener('click', (e) => {
            if (!this.workspace.contains(e.target)) {
                this.hideAllTooltips();
            }
        });
    }

    createIdeaBall(x, y, text, isAIGenerated = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'}`;
        ideaBall.textContent = text;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
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
            if (e.clientX === 0 && e.clientY === 0) return; // Ignore invalid positions
            
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
            e.stopPropagation();
            this.showTooltip(ideaBall, text);
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
        const idea = { element: ideaBall, text, isAIGenerated, x, y };
        this.ideas.push(idea);
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
