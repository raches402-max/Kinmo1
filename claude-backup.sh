#!/bin/bash

# Claude Code Session & Plugin Backup for Replit
# Backs up session files and plugin configs before container restarts

CLAUDE_DIR="$HOME/.claude/projects/-home-runner-workspace"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_PLUGINS_DIR="$HOME/.claude/plugins"
KNOWN_MARKETPLACES="$CLAUDE_PLUGINS_DIR/known_marketplaces.json"
BACKUP_DIR="$HOME/workspace/claude_backups"

case "$1" in
  save)
    echo "Saving Claude session files and plugin configs..."
    mkdir -p "$BACKUP_DIR"

    # Backup session files
    if [ -d "$CLAUDE_DIR" ]; then
      cp "$CLAUDE_DIR"/*.jsonl "$BACKUP_DIR/" 2>/dev/null
      count=$(ls -1 "$BACKUP_DIR"/*.jsonl 2>/dev/null | wc -l)
      echo "Saved $count session file(s)"
    else
      echo "No Claude session directory found"
    fi

    # Backup settings.json (enabled plugins)
    if [ -f "$CLAUDE_SETTINGS" ]; then
      cp "$CLAUDE_SETTINGS" "$BACKUP_DIR/"
      echo "Saved settings.json (enabled plugins)"
    fi

    # Backup known_marketplaces.json
    if [ -f "$KNOWN_MARKETPLACES" ]; then
      cp "$KNOWN_MARKETPLACES" "$BACKUP_DIR/"
      echo "Saved known_marketplaces.json (marketplace registry)"
    fi

    echo ""
    echo "Backup complete! Files saved to $BACKUP_DIR"
    ls -lh "$BACKUP_DIR/" 2>/dev/null
    ;;

  restore)
    echo "Restoring Claude session files and plugins..."

    # Restore session files
    if [ -d "$BACKUP_DIR" ] && ls "$BACKUP_DIR"/*.jsonl 1>/dev/null 2>&1; then
      mkdir -p "$CLAUDE_DIR"
      cp "$BACKUP_DIR"/*.jsonl "$CLAUDE_DIR/"
      count=$(ls -1 "$CLAUDE_DIR"/*.jsonl 2>/dev/null | wc -l)
      echo "Restored $count session file(s)"
    else
      echo "No session backup files found"
    fi

    # Restore settings.json
    if [ -f "$BACKUP_DIR/settings.json" ]; then
      mkdir -p "$HOME/.claude"
      cp "$BACKUP_DIR/settings.json" "$CLAUDE_SETTINGS"
      echo "Restored settings.json"
    fi

    # Restore known_marketplaces.json and clone marketplaces
    if [ -f "$BACKUP_DIR/known_marketplaces.json" ]; then
      mkdir -p "$CLAUDE_PLUGINS_DIR"
      cp "$BACKUP_DIR/known_marketplaces.json" "$KNOWN_MARKETPLACES"
      echo "Restored known_marketplaces.json"

      # Clone each marketplace from GitHub
      echo ""
      echo "Installing marketplaces from GitHub..."

      # Parse JSON and clone each marketplace using node
      node -e "
        const data = require('$BACKUP_DIR/known_marketplaces.json');
        Object.entries(data).forEach(([name, info]) => {
          const repo = info.source?.repo || '';
          const location = info.installLocation || '';
          if (repo && location) {
            console.log(name + '|' + repo + '|' + location);
          }
        });
      " 2>/dev/null | while IFS='|' read -r name repo location; do
        if [ -n "$name" ] && [ -n "$repo" ] && [ -n "$location" ]; then
          if [ -d "$location" ]; then
            echo "  $name: already installed"
          else
            echo "  $name: cloning from github.com/$repo..."
            mkdir -p "$(dirname "$location")"
            git clone --depth 1 --quiet "https://github.com/$repo.git" "$location" 2>/dev/null
            if [ $? -eq 0 ]; then
              echo "  $name: installed successfully"
            else
              echo "  $name: failed to install (check internet connection)"
            fi
          fi
        fi
      done

      echo ""
      echo "Marketplace installation complete!"
    fi

    echo ""
    echo "Restore complete! Claude Code plugins are ready."
    ;;

  list)
    echo "=== Backup Status ==="
    echo ""
    echo "Session files backed up:"
    if [ -d "$BACKUP_DIR" ]; then
      ls -1 "$BACKUP_DIR"/*.jsonl 2>/dev/null | wc -l | xargs -I{} echo "  {} file(s)"
    else
      echo "  (none)"
    fi

    echo ""
    echo "Plugin configs backed up:"
    [ -f "$BACKUP_DIR/settings.json" ] && echo "  settings.json" || echo "  (no settings.json)"
    [ -f "$BACKUP_DIR/known_marketplaces.json" ] && echo "  known_marketplaces.json" || echo "  (no known_marketplaces.json)"

    echo ""
    echo "=== Current Status ==="
    echo ""
    echo "Session files:"
    if [ -d "$CLAUDE_DIR" ]; then
      ls -1 "$CLAUDE_DIR"/*.jsonl 2>/dev/null | wc -l | xargs -I{} echo "  {} file(s)"
    else
      echo "  (none)"
    fi

    echo ""
    echo "Installed marketplaces:"
    if [ -f "$KNOWN_MARKETPLACES" ]; then
      node -e "
        const data = require('$KNOWN_MARKETPLACES');
        Object.entries(data).forEach(([name, info]) => {
          const repo = info.source?.repo || '';
          console.log('  ' + name + ' (github.com/' + repo + ')');
        });
      " 2>/dev/null || echo "  (error reading marketplaces)"
    else
      echo "  (none installed)"
    fi

    echo ""
    echo "Enabled plugins:"
    if [ -f "$CLAUDE_SETTINGS" ]; then
      node -e "
        const data = require('$CLAUDE_SETTINGS');
        const plugins = data.enabledPlugins || {};
        Object.entries(plugins).forEach(([plugin, enabled]) => {
          if (enabled) console.log('  ' + plugin);
        });
      " 2>/dev/null || echo "  (error reading settings)"
    else
      echo "  (no settings file)"
    fi
    ;;

  *)
    echo "Claude Code Session & Plugin Backup for Replit"
    echo ""
    echo "Usage: $0 {save|restore|list}"
    echo ""
    echo "  save    - Backup session files AND plugin configs before restart"
    echo "  restore - Restore sessions, configs, and reinstall plugins from GitHub"
    echo "  list    - Show backup status and installed plugins"
    echo ""
    echo "Workflow:"
    echo "  1. Before closing Replit:  ./claude-backup.sh save"
    echo "  2. After restart:          ./claude-backup.sh restore"
    echo "  3. Then run Claude Code - plugins will be ready!"
    ;;
esac
