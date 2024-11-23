const { run } = require('@jxa/run');
const { log } = require('console');

async function getTasksWithTagsAndFolders(tags, folderNames) {
    try {
        const jxaScript = (tags, folderNames) => {
            const app = Application('OmniFocus');
            const doc = app.defaultDocument;
            const allTasks = [];

            // Helper function to check if a project is under any of the specified folders
            const isInFolders = (project, folderNames) => {
                let currentContainer = project;
                while (currentContainer) {
                    if (currentContainer.name() === "OmniFocus") {
                        break;
                    }
                    const containerName = currentContainer.name();  // Access 'name' without parentheses
                    console.log(`Checking container: ${containerName}`);
                    if (containerName && folderNames.includes(containerName)) {
                        return true;
                    }
                    console.log(typeof currentContainer.container())
                    // Move up the hierarchy
                    let nextContainer = null;
                    if (typeof currentContainer.containingFolder === 'function') {
                        console.log("hello")
                        nextContainer = currentContainer.container();
                        console.log("bello")
                    } else if (typeof currentContainer.containingProject === 'function') {
                        nextContainer = currentContainer.containingProject();
                    } else if (typeof currentContainer.container === 'function') {
                        nextContainer = currentContainer.container();
                    }
                    console.log("helo")
                    if (nextContainer && nextContainer !== currentContainer) {
                        currentContainer = nextContainer;
                    } else {
                        currentContainer = null;
                    }
                }
                return false;
            };


            // Step 1: Gather all tasks that match any of the tags
            tags.forEach(tagName => {
                const tag = doc.flattenedTags().find(t => t.name() === tagName);
                if (tag) {
                    const tasks = tag.tasks().map(task => ({
                        name: task.name(),
                        id: task.id(),
                        tag: tagName,
                        project: task.containingProject().name(),
                        projectId: task.containingProject().id()
                    }));
                    allTasks.push(...tasks);
                }
            });
            
            // Step 2: Filter tasks by checking if any ancestor folder matches
            const matchingTasks = allTasks.filter(task => {
                const project = doc.flattenedProjects().find(p => p.id() === task.projectId);
                console.log('Checking task:', task.name, 'in project:', project.name());
                if (project) {
                    console.log(`Checking project: ${project.name()}`);
                    return isInFolders(project, folderNames);
                }
                return false;
            });

            return JSON.stringify(matchingTasks);
        };

        const result = await run(jxaScript, tags, folderNames);
        const tasks = JSON.parse(result);

        console.log(`Tasks with tags ${tags.join(', ')} in folders ${folderNames.join(', ')}:`);
        tasks.forEach(task => {
            console.log(`- ${task.name} (ID: ${task.id}, Tag: ${task.tag}, Project: ${task.project})`);
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

// Example usage: pass an array of tag names and an array of folder names
getTasksWithTagsAndFolders(['onGoing'], ['Eckstein']);