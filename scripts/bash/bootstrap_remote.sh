#!/bin/bash

# Bootstrap script for remote bash sessions
# Sets up AI prompt token and wrapped function

export AI_PROMPT_TOKEN="__AI_PROMPT_REMOTE__"
export PS1="${AI_PROMPT_TOKEN}> "

# Define the wrapped function for command execution
wrapped() {
    local id="$1"
    shift
    local cmd="$*"
    
    printf '\n__AI_EVT__:%s:START\n' "$id"
    
    # Execute command with proper error handling
    ( set -o pipefail; eval "$cmd" )
    local s=$?
    
    printf '\n__AI_EVT__:%s:END:%d\n' "$id" "$s"
}