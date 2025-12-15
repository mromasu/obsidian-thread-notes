# Changelog

## [0.0.22] - 2025-12-15

### ✨ New Features

- **Property Editor**: Full YAML frontmatter property editor with type-specific inputs
  - Support for Text, Number, Checkbox, Date, DateTime, and List types
  - Inline add/delete/edit property functionality
  - Tag-style list input with pill UI
  
- **New Commands**:
  - `Toggle properties panel` - Show/hide properties section
  - `Add property` - Opens properties panel and triggers inline add form

- **Multi-Editor Thread Rendering**:
  - Main thread chain renders at top
  - Reply chains render below with separators
  - Each editor saves to its own file

### 🔧 Improvements

- Thread graph now supports `getReplyChains()` for nested thread navigation
- Added `getChainFromNote()` for forward-only chain traversal
- Property editor toggle animation with smooth transitions

### 🐛 Bug Fixes

- Fixed add property command not triggering after cancel (changed from boolean to counter mechanism)
- Fixed reply chain rendering to exclude parent notes already in main chain
