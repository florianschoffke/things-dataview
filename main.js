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
        const config = this.parseConfig(source);

        const items = await this.retrieveItems(config);

        el.empty();

        if (items.length === 0) {
            el.createEl('p', { text: 'No items found.' });
            return;
        }

        const tableEl = el.createEl('table');
        const headerRow = tableEl.createEl('tr');
        headerRow.createEl('th', { text: 'Name' });

        items.forEach(item => {
            const row = tableEl.createEl('tr');
            const summaryCell = row.createEl('td');
            const itemLink = `things:///show?id=${item.id}`;
            const linkEl = summaryCell.createEl('a', { text: item.name, href: itemLink });
            linkEl.style.textDecoration = 'none';
            linkEl.style.color = 'inherit';
        });

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
                config[key.toLowerCase()] = value;
            }
        });
        return config;
    }

    async retrieveItems(config) {
        function escapeString(str) {
            return str
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
        }

        const type = config.type ? escapeString(config.type) : 'task';
        const tags = config.tags ? escapeString(config.tags) : '';
        const project = config.project ? escapeString(config.project) : '';
        const areas = config.area ? escapeString(config.area) : '';

        let script = `
    (() => {
        const Things = Application('Things3');
        let items = [];
        const config = {
            type: '${type}',
            tags: '${tags}',
            project: '${project}',
            areas: '${areas}'
        };

        const areaNames = config.areas ? config.areas.split(',').map(s => s.trim()) : [];

        if (config.type.toLowerCase() === 'project') {
            let projects = Things.projects();

            if (areaNames.length > 0) {
                projects = projects.filter(project => {
                    const projectArea = project.area();
                    return projectArea && areaNames.includes(projectArea.name());
                });
            }

            if (config.tags) {
                const tagNames = config.tags.split(',').map(tag => tag.trim());
                projects = projects.filter(project => {
                    const projectTags = project.tagNames();
                    return tagNames.some(tag => projectTags.includes(tag));
                });
            }

            items = projects.filter(project => project.status() === 'open'); // Filter open projects
        } else {
            // type is 'task' or default
            let tasks = Things.toDos();

            if (areaNames.length > 0) {
                tasks = tasks.filter(task => {
                    let taskAreaName = null;

                    if (task.area()) {
                        taskAreaName = task.area().name();
                    }
                    else if (task.project() && task.project().area()) {
                        taskAreaName = task.project().area().name();
                    }

                    return taskAreaName && areaNames.includes(taskAreaName);
                });
            }

            if (config.project) {
                const projectName = config.project;
                const projects = Things.projects().filter(project => project.name() === projectName);
                if (projects.length > 0) {
                    const project = projects[0];
                    tasks = tasks.filter(task => {
                        const taskProject = task.project();
                        return taskProject && taskProject.id() === project.id();
                    });
                }
            }

            if (config.tags) {
                const tagNames = config.tags.split(',').map(tag => tag.trim());
                tasks = tasks.filter(task => {
                    const taskTags = task.tagNames();
                    return tagNames.some(tag => taskTags.includes(tag));
                });
            }

            items = tasks.filter(task => task.status() === 'open'); // Filter open tasks
        }

        return JSON.stringify(items.map(item => ({ id: item.id(), name: item.name() })));
    })();
        `;

        try {
            const result = await this.executeJXA(script);

            console.log('Raw JXA Output:', result);

            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to retrieve items:', error);
            return [];
        }
    }

    executeJXA(script) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const crypto = require('crypto');

            const tmpDir = os.tmpdir();
            // Generate a unique filename using random bytes
            const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
            const tmpFile = path.join(tmpDir, `obsidian-things-script-${uniqueSuffix}.js`);

            fs.writeFile(tmpFile, script, (writeErr) => {
                if (writeErr) {
                    reject(writeErr);
                    return;
                }

                const command = `osascript -l JavaScript "${tmpFile}"`;

                console.log('Executing command:', command);

                exec(command, (error, stdout, stderr) => {
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