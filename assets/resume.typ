#let resume = json("resume.json")
#let design = sys.inputs
#let points(value) = float(value) * 1pt
#let millimeters(value) = float(value) * 1mm
#let primary = rgb(design.at("primary-color"))
#let secondary = rgb(design.at("secondary-color"))
#let link-color = rgb(design.at("link-color"))
#show link: set text(fill: link-color)
#set document(
  title: resume.basics.name,
  author: "Resume Toolkit",
  keywords: ("resume", "design-" + design.at("design-version")),
)
#set page(
  width: millimeters(design.at("paper-width-mm")),
  height: millimeters(design.at("paper-height-mm")),
  margin: (
    top: millimeters(design.at("margin-top-mm")),
    right: millimeters(design.at("margin-right-mm")),
    bottom: millimeters(design.at("margin-bottom-mm")),
    left: millimeters(design.at("margin-left-mm")),
  ),
)
#set text(
  font: (
    design.at("font-family"),
    design.at("font-fallback-cjk"),
    design.at("font-fallback-emoji"),
  ),
  size: points(design.at("body-font-pt")),
  fill: primary,
)
#set par(
  justify: false,
  leading: float(design.at("typst-leading-em")) * 1em,
  spacing: points(design.at("paragraph-after-pt")),
)
#set list(
  indent: 0pt,
  body-indent: millimeters(design.at("bullet-hanging-indent-mm")),
  spacing: points(design.at("bullet-after-pt")),
)

#let section-heading(value) = block(
  width: 100%,
  above: 0pt,
  below: points(design.at("section-after-pt")),
  sticky: true,
)[
  #set par(spacing: points(design.at("section-rule-gap-pt")))
  #text(size: points(design.at("section-heading-font-pt")), weight: "bold", fill: primary)[#value]
  #line(length: 100%, stroke: points(design.at("section-rule-pt")) + primary)
]
#let entry-header(entry, section) = block(width: 100%, sticky: true)[
  #grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [#text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.heading]],
    align(right)[#if entry.dateText != "" [#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.dateText]]],
  )
  #if section.subtitleSlots [
    #if entry.detail != "" [
      #par(spacing: points(design.at("paragraph-after-pt")))[
        #text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.detail]
      ]
    ]
    #let visible-slots = ()
    #for (index, slot) in entry.subtitle.enumerate() [
      #if slot != "" [
        #visible-slots.push((index, slot))
      ]
    ]
    #if visible-slots.len() > 0 [
      #par(spacing: points(design.at("paragraph-after-pt")))[
        #for (i, (index, slot)) in visible-slots.enumerate() [
          #if i > 0 [ | ]
          #if "url" in entry and slot == entry.urlLabel [
            #link(entry.url)[#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: link-color)[#slot]]
          ] else [
            #text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#slot]
          ]
        ]
      ]
    ]
  ] else if entry.detail != "" or ("url" in entry) [
    #par(spacing: points(design.at("paragraph-after-pt")))[
      #if entry.detail != "" [#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.detail]]
      #if "url" in entry [
        #if entry.detail != "" [ | ]
        #link(entry.url)[#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: link-color)[#entry.urlLabel]]
      ]
    ]
  ]
]

#let skill-line(group) = {
  let label = if "category" in group { group.category } else { "Skills" }
  par(spacing: points(design.at("skill-line-after-pt")))[
    #text(weight: "bold")[#label:] #group.labels.join(", ")
  ]
}

#let contacts = (
  if "location" in resume.basics { resume.basics.location } else { none },
  if "phone" in resume.basics { resume.basics.phone } else { none },
  if "email" in resume.basics { resume.basics.email } else { none },
).filter(value => value != none and value != "")

#align(center)[
  #par(spacing: 0pt)[
    #text(size: points(design.at("name-font-pt")), weight: "bold", fill: primary)[#resume.basics.name]
  ]
  #v(points(design.at("name-after-pt")))
  #if ("headline" in resume.basics or contacts.len() > 0 or resume.basics.links.len() > 0) [
    #v(points(float(design.at("typst-trailing-gap-em")) * float(design.at("name-font-pt"))))
  ]
  #if "headline" in resume.basics [
    #par(spacing: 0pt)[
      #text(size: points(design.at("headline-font-pt")), fill: secondary)[#resume.basics.headline]
    ]
    #v(points(design.at("headline-after-pt")))
    #if (contacts.len() > 0 or resume.basics.links.len() > 0) [
      #v(points(float(design.at("typst-trailing-gap-em")) * float(design.at("headline-font-pt"))))
    ]
  ]
  #if contacts.len() > 0 [
    #par(spacing: 0pt)[
      #text(size: points(design.at("contact-font-pt")), fill: secondary)[#contacts.join(" | ")]
    ]
  ]
  #if contacts.len() > 0 and resume.basics.links.len() > 0 [
    #v(points(float(design.at("typst-trailing-gap-em")) * float(design.at("contact-font-pt"))))
  ]
  #if resume.basics.links.len() > 0 [
    #par(spacing: 0pt)[
      #for (line-index, line) in resume.basics.linkLines.enumerate() [
        #if line-index > 0 [#linebreak()]
        #text(size: points(design.at("contact-font-pt")), fill: secondary)[
          #for (index, item) in line.enumerate() [
            #if index > 0 [ | ]
            #if "url" in item [#box(link(item.url)[#text(fill: link-color)[#item.label]])]
            #if "url" not in item [#box(item.label)]
          ]
        ]
      ]
      ]
    ]
  ]
#v(points(design.at("header-after-pt")))

  #for section in resume.sections [
    #if section.kind == "summary" [
      #v(points(design.at("section-before-pt")))
      #section-heading(section.title)
      #par(spacing: points(design.at("paragraph-after-pt")))[#resume.summary.join(" ")]
    ] else if section.kind == "skills" and resume.skills.len() > 0 [
      #for (group-index, group) in resume.skills.enumerate() [
        #if group-index == 0 [
          #v(points(design.at("section-before-pt")))
          #block(width: 100%, sticky: true)[
            #section-heading(section.title)
            #skill-line(group)
          ]
        ] else [
          #skill-line(group)
        ]
      ]
    ] else if section.kind != "skills" and section.entries.len() > 0 [
      #for (entry-index, entry) in section.entries.enumerate() [
      #if entry-index == 0 [
        #v(points(design.at("section-before-pt")))
        #block(width: 100%, sticky: true)[
          #section-heading(section.title)
          #entry-header(entry, section)
        ]
      ] else [
        #v(points(design.at("entry-after-pt")))
        #entry-header(entry, section)
      ]
      #if entry.bullets.len() > 0 [
        #list(
          indent: 0pt,
          body-indent: millimeters(design.at("bullet-hanging-indent-mm")),
          spacing: points(design.at("bullet-after-pt")),
          ..entry.bullets.map(bullet => [#text(size: points(design.at("bullet-font-pt")))[#bullet]]),
        )
      ]
    ]
  ]
]
