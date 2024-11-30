const { Plugin } = require('obsidian');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = class ThingsPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor('things', async (source, el, ctx) => {
            await this.processThingsBlock(source, el);
        });
    }

    async processThingsBlock(source, el) {
        // Parse the code block
        const config = this.parseConfig(source);

        // Retrieve tasks using JXA
        const tasks = await this.retrieveTasks(config);

        // Clear previous content
        el.empty();

        // Create a table element
        const tableEl = el.createEl('table');
        const headerRow = tableEl.createEl('tr');
        headerRow.createEl('th', { text: 'Task' });

        tasks.forEach(task => {
            const row = tableEl.createEl('tr');
            const summaryCell = row.createEl('td');
            const taskLink = `things:///show?id=${task.id}`;
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
        reloadButton.onclick = async () => {
            await this.processThingsBlock(source, el);
        };
        el.prepend(reloadButton);
    }

    parseConfig(source) {
        const lines = source.split('\n');
        const config = {};
        lines.forEach(line => {
            const [key, value] = line.split(':').map(part => part.trim());
            if (key && value) {
                config[key] = value;
            }
        });
        return config;
    }

    async retrieveTasks(config) {
        // Helper function to escape strings for JavaScript
        function escapeString(str) {
            return str
                .replace(/\\/g, '\\\\')   // Escape backslashes
                .replace(/"/g, '\\"')     // Escape double quotes
                .replace(/'/g, "\\'")     // Escape single quotes
                .replace(/\n/g, '\\n')    // Escape newlines
                .replace(/\r/g, '\\r');   // Escape carriage returns
        }

        const tags = config.tags ? escapeString(config.tags) : '';
        const project = config.project ? escapeString(config.project) : '';

        // Build the JXA script with the working code
        let script = `
(() => {
    const Things = Application('Things3');
    let tasks = [];
    const config = {
        tags: '${tags}',
        project: '${project}'
    };

    if (config.project && config.tags) {
        const projectName = config.project;
        const tagNames = config.tags.split(',').map(tag => tag.trim());
        const projects = Things.projects.whose({ name: projectName })();
        if (projects.length > 0) {
            const projectTasks = projects[0].toDos();
            tasks = projectTasks.filter(task => {
                const taskTags = task.tagNames();
                return tagNames.some(tag => taskTags.includes(tag));
            });
        } else {
            console.log('Project not found:', projectName);
            return 'Project not found: ' + projectName;
        }
    } else if (config.project) {
        const projectName = config.project;
        const projects = Things.projects.whose({ name: projectName })();
        if (projects.length > 0) {
            tasks = projects[0].toDos();
        } else {
            console.log('Project not found:', projectName);
            return 'Project not found: ' + projectName;
        }
    } else if (config.tags) {
        const tagNames = config.tags.split(',').map(tag => tag.trim());
        tasks = Things.toDos().filter(task => {
            const taskTags = task.tagNames();
            return tagNames.some(tag => taskTags.includes(tag));
        });
    } else {
        // If neither tags nor project are specified, retrieve all tasks
        tasks = Things.toDos();
    }

    // Return the tasks with their id and name
    return JSON.stringify(tasks.map(task => ({ id: task.id(), name: task.name() })));
})();
        `;

        try {
            const result = await this.executeJXA(script);

            // Log the raw output for debugging purposes
            console.log('Raw JXA Output:', result);

            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to retrieve tasks:', error);
            return [];
        }
    }

    executeJXA(script) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');

            // Create a temporary file for the script
            const tmpDir = os.tmpdir();
            const tmpFile = path.join(tmpDir, `obsidian-things-script-${Date.now()}.js`);

            // Write the script to the temporary file
            fs.writeFile(tmpFile, script, (writeErr) => {
                if (writeErr) {
                    reject(writeErr);
                    return;
                }

                const command = `osascript -l JavaScript "${tmpFile}"`;

                // Log the command for debugging
                console.log('Executing command:', command);

                exec(command, (error, stdout, stderr) => {
                    // Clean up the temporary file
                    fs.unlink(tmpFile, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Failed to delete temp file:', unlinkErr);
                        }
                    });

                    if (error) {
                        reject(stderr);
                    } else {
                        resolve(stdout.trim());
                    }
                });
            });
        });
    }
};