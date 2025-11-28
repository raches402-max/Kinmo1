#!/bin/bash
# Setup script for Claude Code plugins
# Run this after starting a new Replit session

BACKUP_DIR="/home/runner/workspace/.claude-backup"
PLUGIN_DIR="/home/runner/.claude/plugins"

# Check if backup exists
if [ -d "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/known_marketplaces.json" ]; then
    echo "Restoring Claude Code plugins from backup..."
    mkdir -p "$PLUGIN_DIR"
    cp -r "$BACKUP_DIR"/* "$PLUGIN_DIR/"
    echo "✓ Plugins restored successfully!"
    echo ""
    echo "Restart Claude Code to load the plugins."
else
    echo "No backup found. Run these commands in Claude Code:"
    echo ""
    echo "  /plugin marketplace add anthropics/claude-code"
    echo "  /plugin marketplace add anthropics/skills"
    echo "  /plugin marketplace add FrancyJGLisboa/agent-skill-creator"
    echo "  /plugin install frontend-design@claude-code-plugins"
    echo ""
    echo "Then run: ./setup-claude-plugins.sh --backup"
fi

# Backup option
if [ "$1" == "--backup" ]; then
    echo "Backing up plugins..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$PLUGIN_DIR"/* "$BACKUP_DIR/"
    echo "✓ Backup saved to $BACKUP_DIR"
fi
