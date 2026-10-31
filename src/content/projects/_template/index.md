---
# Copy this whole folder, rename the copy (the folder name becomes the web address:
# a folder called "riverside-villa" is shown at /work/riverside-villa/), then put the
# project's images in the same folder. Folders starting with "_" are ignored.

title: Project Name
order: 10                  # position in the menu and on the project list
type: Private residence    # shown under the name, e.g. Office interior, Masterplan
category: Architectural    # the category it is listed under in the menu (Projects), e.g. Interior
location: Ahmedabad, Gujarat
line: A short line about the *idea* of the project.   # a *word* in stars is set lighter

facts:                     # any labels you like, shown as a small table
  Year: 2026
  Status: Completed
  Site: 1,200 sq m
  Scope: Architecture & interiors

cover: front.jpg           # the full-screen first image (must be listed below)

images:                    # in the order they appear in the project view
  - file: front.jpg
    caption: Street front, dusk
    alt: The house seen from the street at dusk     # describes the image for screen readers
    wall: landscape        # also show it on the wall: tall, portrait, square, landscape, wide or standard
  - file: living.jpg
    caption: Living room
    wall: portrait
    focus: [0.3, 0.5]      # where to centre the crop on the wall: [left→right, top→bottom], 0 to 1
  - file: plan.jpg
    caption: Ground floor plan  # no "wall:" line → only in the project view

# Video: give a poster image as `file` and the clip as `video` (MP4, no sound needed).
#  - file: walkthrough.jpg
#    video: walkthrough.mp4
#    caption: Walkthrough

draft: true                # remove this line to publish the project
---

One or two paragraphs about the project. Blank lines start a new paragraph.

You can use *italic* and **bold**.
