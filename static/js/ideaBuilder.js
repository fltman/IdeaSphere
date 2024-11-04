document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const ideaManager = new IdeaManager('idea-workspace');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const combineIdeasBtn = document.getElementById('combineIdeasBtn');
    let pendingIdeaPosition = null;

    document.addEventListener('workspace-click', function(e) {
        console.log('Workspace click event received:', e.detail);
        pendingIdeaPosition = { x: e.detail.x, y: e.detail.y };
        ideaModal.show();
    });

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaInput = document.getElementById('ideaInput');
        const ideaText = ideaInput.value.trim();
        console.log('Save idea clicked:', { ideaText, position: pendingIdeaPosition });
        
        if (ideaText && pendingIdeaPosition) {
            const newIdea = ideaManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            console.log('New idea created:', newIdea);
            
            ideaInput.value = '';
            ideaModal.hide();
            pendingIdeaPosition = null;
        } else {
            console.warn('Cannot save idea: missing text or position');
        }
    });

    clearCanvasBtn.addEventListener('click', function() {
        console.log('Clearing workspace');
        ideaManager.clearWorkspace();
    });

    combineIdeasBtn.addEventListener('click', function() {
        if (ideaManager.isSelectMode) {
            if (ideaManager.selectedIdeas.length === 2) {
                const idea1 = ideaManager.selectedIdeas[0];
                const idea2 = ideaManager.selectedIdeas[1];
                
                // Send both ideas to AI for combination
                fetch('/generate-ideas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        idea: `Combine these two ideas: 1. ${idea1.text} 2. ${idea2.text}`
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const combinedIdeas = JSON.parse(data.data).ideas;
                        // Create new idea at midpoint
                        const x1 = parseInt(idea1.element.style.left);
                        const y1 = parseInt(idea1.element.style.top);
                        const x2 = parseInt(idea2.element.style.left);
                        const y2 = parseInt(idea2.element.style.top);
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        
                        // Create the combined idea
                        const newIdea = ideaManager.addIdea(midX, midY, combinedIdeas[0].text);
                        ideaManager.connectIdeas(idea1, newIdea);
                        ideaManager.connectIdeas(idea2, newIdea);
                    }
                });
            }
            ideaManager.exitSelectMode();
            combineIdeasBtn.textContent = 'Kombinera idéer';
            combineIdeasBtn.classList.remove('btn-secondary');
            combineIdeasBtn.classList.add('btn-outline-primary');
        } else {
            ideaManager.enterSelectMode();
            combineIdeasBtn.textContent = 'Avsluta val';
            combineIdeasBtn.classList.remove('btn-outline-primary');
            combineIdeasBtn.classList.add('btn-secondary');
        }
    });
});
