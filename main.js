const { Plugin } = require('obsidian');
const { execSync } = require('child_process');

class OmniFocusDataviewPlugin extends Plugin {
    onload() {
        console.log('Loading OmniFocus Dataview Plugin');

        this.registerMarkdownCodeBlockProcessor('search-omni', this.processOmniBlock.bind(this));
    }

    async processOmniBlock(source, el, ctx) {
        const lines = source.split('\n');
        let projectName = null;
        let folderName = null;
        let tagName = null;

        // Parse the project, folder, or tag from the code block
        for (const line of lines) {
            const projectMatch = line.match(/^project:\s*(.+)$/);
            const folderMatch = line.match(/^list-projects:\s*(.+)$/);
            const tagMatch = line.match(/^tag:\s*(.+)$/);
            if (projectMatch) {
                projectName = projectMatch[1].trim();
                break;
            }
            if (folderMatch) {
                folderName = folderMatch[1].trim();
                break;
            }
            if (tagMatch) {
                tagName = tagMatch[1].trim();
                break;
            }
        }

        let tasks = [];
        if (projectName) {
            tasks = this.fetchTasksFromProject(projectName);
        } else if (folderName) {
            tasks = this.listProjectsInFolder(folderName);
        } else if (tagName) {
            tasks = this.fetchTasksWithTag(tagName);
        }

        // Clear previous content
        el.empty();

        // Create a table element
        const tableEl = el.createEl('table');
        const headerRow = tableEl.createEl('tr');
        headerRow.createEl('th', { text: 'Task' });

        tasks.forEach(task => {
            const row = tableEl.createEl('tr');
            const summaryCell = row.createEl('td');
            const taskLink = `omnifocus:///task/${task.id}`;
            const linkEl = summaryCell.createEl('a', { text: task.name, href: taskLink });
            linkEl.style.textDecoration = 'none';
            linkEl.style.color = 'inherit';
        });

        // Add a subtle reload button
        const reloadButton = el.createEl('button', { text: '↻' });
        reloadButton.style.border = 'none';
        reloadButton.style.background = 'none';
        reloadButton.style.cursor = 'pointer';
        reloadButton.style.float = 'right';
        reloadButton.style.fontSize = '1.2em';
        reloadButton.onclick = () => {
            this.processOmniBlock(source, el, ctx);
        };
        el.prepend(reloadButton);
    }

    fetchTasksFromProject(projectName) {
        try {
            // JavaScript for Automation (JXA) script to fetch projects
            const jxaScript = `
                const allProjects = Application('OmniFocus').defaultDocument.flattenedProjects();
                const project = allProjects.find(p => p.name() === '${projectName}');
                if (!project) throw new Error('Project not found');
                const tasks = project.tasks().map(task => ({
                    name: task.name(),
                    id: task.id()  // Add task ID for linking
                }));
                JSON.stringify(tasks);
            `;

            console.log(`Executing script for project: ${projectName}`);
            const result = execSync(`osascript -l JavaScript -e "${jxaScript}"`, { encoding: 'utf8' });
            return JSON.parse(result);
        } catch (error) {
            console.error('Error fetching tasks from OmniFocus:', error);
            return [];
        }
    }

    listProjectsInFolder(folderName) {
        try {
            // JavaScript for Automation (JXA) script to list projects in a folder
            const jxaScript = `
                const app = Application('OmniFocus');
                const doc = app.defaultDocument;
                const folder = doc.flattenedFolders.byName('${folderName}');
                if (!folder) throw new Error('Folder not found');
                const projects = folder.projects().map(project => ({
                    name: project.name(),
                    id: project.id()  // Add project ID for linking
                }));
                JSON.stringify(projects);
            `;

            console.log(`Executing script for folder: ${folderName}`);
            const result = execSync(`osascript -l JavaScript -e "${jxaScript}"`, { encoding: 'utf8' });
            return JSON.parse(result);
        } catch (error) {
            console.error('Error listing projects from OmniFocus:', error);
            return [];
        }
    }

    fetchTasksWithTag(tagName) {
        try {
            // JavaScript for Automation (JXA) script to fetch tasks with a tag
            const jxaScript = `
                const app = Application('OmniFocus');
                const doc = app.defaultDocument;
                const tag = doc.flattenedTags.byName('${tagName}');
                if (!tag) throw new Error('Tag not found');
                const tasks = tag.tasks().map(task => ({
                    name: task.name(),
                    id: task.id()  // Add task ID for linking
                }));
                JSON.stringify(tasks);
            `;

            console.log(`Executing script for tag: ${tagName}`);
            const result = execSync(`osascript -l JavaScript -e "${jxaScript}"`, { encoding: 'utf8' });
            return JSON.parse(result);
        } catch (error) {
            console.error('Error fetching tasks from OmniFocus:', error);
            return [];
        }
    }

    onunload() {
        console.log('Unloading OmniFocus Dataview Plugin');
    }
}

module.exports = OmniFocusDataviewPlugin;
