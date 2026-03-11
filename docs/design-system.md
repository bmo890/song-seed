# Song Seed Design System

This document defines the design philosophy, interaction model, and reusable UI patterns used throughout Song Seed.

## Design Principles

The system follows five principles.

### 1. Simplicity

The interface should prioritize clarity over features.

If a feature requires too much UI, it should be hidden behind progressive disclosure.

### 2. Creative Focus

The app exists to capture and develop ideas.

The UI must always prioritize:
- audio ideas
- lyrics
- creative evolution

over configuration and metadata.

### 3. Progressive Disclosure

Show only what is needed in the moment.

Examples:
- lyrics collapsed by default where appropriate
- metadata inside tabs or compact strips
- advanced actions in overflow menus

### 4. Predictability

Users should not need to learn new interaction models per screen.

Shared patterns must behave the same everywhere.

### 5. Calm Aesthetic

The UI should feel:
- quiet
- focused
- inviting

Avoid bright colors, heavy decoration, or dashboard-like density.

## Layout Structure

Most screens should follow the same high-level structure.

### Header
- breadcrumbs
- title
- optional subtitle/status

### Primary content
- ideas list
- takes/evolution
- waveform/editor surface
- recording surface

### Secondary tools
- lyrics
- notes
- metadata views

### Actions
- recording controls
- playback controls
- create/import controls

## Interaction Zones

Use these internal categories when organizing a screen.

### 1. Global nav
- drawer/menu access
- escape routes
- breadcrumb context

### 2. Local nav
- collection/subcollection switching
- song sub-tabs
- scoped navigation inside the current context

### 3. Discovery
- search
- filter
- sort
- visibility/density controls

### 4. List actions
- play all
- select mode entry
- unhide all

These should be contextual where possible, not always visible.

### 5. Content
- cards
- lists
- waveforms
- timelines
- dividers
- sticky section controls

### 6. Create
- floating add/record controls
- import actions

## Core Components

Screens should be composed from shared building blocks.

Recommended core components:
- `AppHeader`
- `AppBreadcrumbs`
- `SearchField`
- `FilterSortControls`
- `OverflowMenu`
- `BottomActionDock`
- `SegmentedToggle`
- `SectionHeader`
- `SummaryCard`
- `ListCard`
- `ActionSheet`
- `StatusChip`
- `WaveformMiniPreview`

Reuse these patterns before creating new component styles.

## Cards

Cards are for content.

Correct uses:
- clips
- songs
- primary take
- idea items
- collection content rows if they represent browseable content

Incorrect uses:
- timers
- generic controls
- top-level navigation
- page scaffolding

Cards should feel like content containers, not generic rounded rectangles used everywhere.

## Headers

Use a consistent page header pattern.

### Structure
- left: navigation control
- center: breadcrumb context
- right: overflow menu

Below that:
- page title
- optional compact status/subtitle

Breadcrumbs should be:
- subtle
- small
- single-line
- truncated when deep

Example:

`Main › Songs`

## Controls

Controls should sit directly on the surface whenever possible.

### Action tiers

#### Primary
- one large obvious action
- examples:
  - Record
  - Save

#### Secondary
- inline button or icon
- examples:
  - Play
  - Open
  - Sort

#### Advanced / destructive
- overflow menu
- examples:
  - Delete
  - Discard
  - Change input
  - Settings

Avoid showing many equal-weight buttons at once.

## Text Usage

Text should be minimal and self-evident.

Avoid unnecessary labels like:
- sticky controls
- paused take
- recording panel

Prefer:
- Recording
- Paused

## Tabs

Tabs should be used for related modes or metadata, not for global navigation.

Good examples:
- `Takes | Lyrics | Notes`
- `Timeline | Evolution`

Tabs should reduce vertical clutter, not add more.

## Expandable Panels

Expandable sections are useful for keeping density under control.

Collapsed state should show:
- title
- short summary

Expanded state reveals the detail.

Examples:
- lyrics panel
- notes panel
- metadata groups

When expanded, nearby content may shrink if that improves focus.

## Lists

Lists represent collections of content.

Examples:
- ideas list
- songs list
- clip/take list

List items should typically contain:
- title
- compact metadata
- waveform preview if relevant

List items must stay visually consistent across screens.

## Audio Visualization

Waveforms are a primary visual element.

Waveform components should:
- remain visually consistent
- have predictable interactions
- support scrubbing when appropriate
- be large enough to read clearly

Interaction rules:
- tap waveform or play zone -> play/pause
- drag waveform -> scrub

## Recording UI

Recording interfaces should remain extremely simple.

Key elements:
- waveform
- recording timer
- recording state
- sticky bottom control bar

Avoid excessive controls during active recording.

Discard should be handled through:
- back confirmation
- or overflow menu

not as a dominant visible action.

## Navigation

Navigation is hierarchical and contextual.

Examples:
- `Home`
- `Workspace`
- `Collection`
- `Subcollection`
- `Song`
- `Clip`

Breadcrumbs should always show where the user is, but remain visually quiet.

## Color Philosophy

Use color sparingly.

Primary color usage:
- selected states
- record button
- active tabs
- status chips

Most surfaces should remain neutral.

## Future Growth

As features expand, they should still follow the same principles:
- minimal
- predictable
- content-first

Examples:
- metronome
- groove loops
- practice tools
- playlists
- library tools

These should extend the same interaction and visual system, not create isolated design languages.
