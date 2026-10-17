#let resume = json("resume.json")
#let design = sys.inputs
#let points(value) = float(value) * 1pt
#let millimeters(value) = float(value) * 1mm
#let primary = rgb(design.at("primary-color"))
#let secondary = rgb(design.at("secondary-color"))
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
  above: points(design.at("section-before-pt")),
  below: points(design.at("section-after-pt")),
  sticky: true,
)[
  #text(size: points(design.at("section-heading-font-pt")), weight: "bold", fill: primary)[#value]
  #line(length: 100%, stroke: points(design.at("section-rule-pt")) + primary)
]
#let entry-header(entry) = block(sticky: true)[
  #grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [#text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.heading]],
    align(right)[#if entry.dateText != "" [#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.dateText]]],
  )
  #if entry.detail != "" or ("url" in entry) [
    #par(spacing: points(design.at("paragraph-after-pt")))[
      #if entry.detail != "" [#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.detail]]
      #if "url" in entry [
        #if entry.detail != "" [ | ]
        #link(entry.url)[#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.urlLabel]]
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
      #text(size: points(design.at("contact-font-pt")), fill: secondary)[
        #for (index, item) in resume.basics.links.enumerate() [
          #if index > 0 [ | ]
          #link(item.url)[#item.label]
        ]
      ]
    ]
  ]
]
#v(points(design.at("header-after-pt")))

#if resume.summary.len() > 0 [
  #section-heading("PROFESSIONAL SUMMARY")
  #par(spacing: points(design.at("paragraph-after-pt")))[#resume.summary.join(" ")]
]


#for section in resume.sections [
  #if section.kind == "skills" and resume.skills.len() > 0 [
    #for (group-index, group) in resume.skills.enumerate() [
      #if group-index == 0 [
        #block(sticky: true)[
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
        #block(sticky: true)[
          #section-heading(section.title)
          #entry-header(entry)
        ]
      ] else [
        #v(points(design.at("entry-after-pt")))
        #entry-header(entry)
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
