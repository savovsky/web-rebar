# Author Notebook

This is a notebook like doc of the author. It holds ideas, toughts and reminders for further docs creation, implementaions, app tools behaviour, etc.

## Commnads

Before any implemntaion - Define a list of the most commands spilt by modules and how they shoould work like - flow, inputs, result, etc.

Example:

1. Structure Module
1.1. Draw 2D

- Line
- Circle
- Ractangle
- ...

1.2. Create 3D elements

- Column
- Wall
- Slab
- Beam
- Борд
- ...

1.3. Edit 2D

- Copy
- Move
- Trim
- Cut
- Strech
- ...

2. Reinforcemnt Module

2.1. Create shape
2.2. Place shape
2.3. Find/Display shape, placment

3. Layout Module (Creating a layout for plot/print/export...)

3.1. Define paper format
3.2. Select view (draw frame to identify what needs to be included)

4. Option for different bar colors

4.1. By mark
4.2. By diameter

5. Bars collisions check button

5.1. Some report in modal... ?!
5.2. Heighlight bars with conflicts
5.3. Option to accept th econflict and marked it in the report and stop higglithing.

6. Search bars - by diameter, by mark
5.1. Some report in modal... ?!
5.2. Heighlight founded bars

/////////////
Option to choose the sclale in 2D views (M 1:0, 1:25, 1:50, 1: 100, etc..)

3D viewport is the primary interaction surface - not sure!?

Double mouse scroll click => Zoom fit(all?!)

## App layout

1. Sidebar - with tabs?

1.1. Tab - Structure Elevation Schema
1.2. Tab - Selection Properties

****************
Ask for Rust linters...

OK cool - its working! I have couple more quetsions before we close this task.
1. At some point I will need to "edit" - delete and move (scale) parts of the (solids, lines, etc.) from the imported files (IFC and DXF) - is it hard to be implemented and is it doable?
2. At some point I will need to split given file (IFC and DXF) in multiple "layers" like the current approach with the checkbox in the right panel - is it hard to be implemented and is it doable?
3. Is it possble to have options for the IFC import like the DXF import for (mm, cm, m, etc.) - is it hard to be implemented and is it doable?