#!/bin/bash

# Add all changes to git
git add .

# Prompt for commit message
echo "Enter commit message:"
read commit_message

# Check if commit message is empty
if [ -z "$commit_message" ]; then
    echo "Error: Commit message cannot be empty"
    git reset
    exit 1
fi

# Commit with the provided message
git commit -m "$commit_message"

echo "Changes committed successfully!"
