#!/bin/bash

# Claude Code Session & Plugin Backup for Replit
# Backs up session files and plugin configs before container restarts
# Auto-prunes old sessions to save space

CLAUDE_DIR="$HOME/.claude/projects/-home-runner-workspace"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_PLUGINS_DIR="$HOME/.claude/plugins"
KNOWN_MARKETPLACES="$CLAUDE_PLUGINS_DIR/known_marketplaces.json"
BACKUP_DIR="$HOME/workspace/claude_backups"

# Configuration
MAX_MAIN_SESSIONS=5      # Keep only the 5 most recent main sessions
AGENT_MAX_AGE_DAYS=7     # Remove agent files older than 7 days

# Helper: Prune old session files
prune_old_sessions() {
  local dir="$1"
  local pruned=0

  if [ ! -d "$dir" ]; then
    return
  fi

  # Prune old main sessions (keep only MAX_MAIN_SESSIONS most recent)
  # Main sessions are UUIDs like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.jsonl
  local main_count=$(ls -1t "$dir"/*.jsonl 2>/dev/null | grep -E '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$' | wc -l)

  if [ "$main_count" -gt "$MAX_MAIN_SESSIONS" ]; then
    # Get files to delete (oldest ones beyond the limit)
    local to_delete=$(ls -1t "$dir"/*.jsonl 2>/dev/null | grep -E '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$' | tail -n +$((MAX_MAIN_SESSIONS + 1)))

    for file in $to_delete; do
      rm -f "$file"
      pruned=$((pruned + 1))
    done
  fi

  # Prune old agent files (older than AGENT_MAX_AGE_DAYS)
  # Agent files are like agent-xxxxxxxx.jsonl
  local old_agents=$(find "$dir" -name "agent-*.jsonl" -mtime +$AGENT_MAX_AGE_DAYS 2>/dev/null)

  for file in $old_agents; do
    rm -f "$file"
    pruned=$((pruned + 1))
  done

  if [ "$pruned" -gt 0 ]; then
    echo "Pruned $pruned old session file(s)"
  fi
}

# Helper: Get human-readable size
get_size() {
  du -sh "$1" 2>/dev/null | cut -f1
}

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

    # Auto-prune old sessions
    echo ""
    prune_old_sessions "$BACKUP_DIR"

    echo ""
    echo "Backup complete! Files saved to $BACKUP_DIR"
    echo "Total size: $(get_size "$BACKUP_DIR")"
    echo ""
    ls -lht "$BACKUP_DIR"/*.jsonl 2>/dev/null | head -10
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

  clean)
    echo "Cleaning old session files..."

    if [ ! -d "$BACKUP_DIR" ]; then
      echo "No backup directory found"
      exit 0
    fi

    echo "Before: $(get_size "$BACKUP_DIR") ($(ls -1 "$BACKUP_DIR"/*.jsonl 2>/dev/null | wc -l) files)"
    echo ""

    prune_old_sessions "$BACKUP_DIR"

    echo ""
    echo "After: $(get_size "$BACKUP_DIR") ($(ls -1 "$BACKUP_DIR"/*.jsonl 2>/dev/null | wc -l) files)"
    ;;

  status)
    echo "=== Backup Status ==="
    echo ""

    if [ -d "$BACKUP_DIR" ]; then
      total_size=$(get_size "$BACKUP_DIR")
      main_count=$(ls -1 "$BACKUP_DIR"/*.jsonl 2>/dev/null | grep -E '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$' | wc -l)
      agent_count=$(ls -1 "$BACKUP_DIR"/agent-*.jsonl 2>/dev/null | wc -l)

      echo "Backup directory: $BACKUP_DIR"
      echo "Total size: $total_size"
      echo ""
      echo "Session files:"
      echo "  Main sessions: $main_count (keeping max $MAX_MAIN_SESSIONS)"
      echo "  Agent files: $agent_count (pruned after $AGENT_MAX_AGE_DAYS days)"
      echo ""
      echo "Recent sessions (newest first):"
      ls -1t "$BACKUP_DIR"/*.jsonl 2>/dev/null | grep -E '/[0-9a-f]{8}-' | head -5 | while read f; do
        size=$(ls -lh "$f" | awk '{print $5}')
        date=$(ls -l "$f" | awk '{print $6, $7, $8}')
        name=$(basename "$f")
        echo "  $size  $date  ${name:0:20}..."
      done
    else
      echo "No backup directory found"
    fi

    echo ""
    echo "Plugin configs:"
    [ -f "$BACKUP_DIR/settings.json" ] && echo "  [x] settings.json" || echo "  [ ] settings.json"
    [ -f "$BACKUP_DIR/known_marketplaces.json" ] && echo "  [x] known_marketplaces.json" || echo "  [ ] known_marketplaces.json"

    echo ""
    echo "=== Current Claude State ==="
    echo ""
    if [ -d "$CLAUDE_DIR" ]; then
      current_size=$(get_size "$CLAUDE_DIR")
      current_count=$(ls -1 "$CLAUDE_DIR"/*.jsonl 2>/dev/null | wc -l)
      echo "Active sessions: $current_count files ($current_size)"
    else
      echo "No active sessions"
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
    ;;

  *)
    echo "Claude Code Session & Plugin Backup for Replit"
    echo ""
    echo "Usage: $0 {save|restore|clean|status}"
    echo ""
    echo "  save    - Backup sessions & plugins, auto-prune old files"
    echo "  restore - Restore sessions & reinstall plugins from GitHub"
    echo "  clean   - Just prune old sessions without saving new ones"
    echo "  status  - Show backup stats and what's installed"
    echo ""
    echo "Settings:"
    echo "  Keep last $MAX_MAIN_SESSIONS main sessions"
    echo "  Prune agent files older than $AGENT_MAX_AGE_DAYS days"
    echo ""
    echo "Workflow:"
    echo "  1. Before closing Replit:  ./claude-backup.sh save"
    echo "  2. After restart:          ./claude-backup.sh restore"
    ;;
esac
