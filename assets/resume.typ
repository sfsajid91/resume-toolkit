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
  #for paragraph in resume.summary [
    #par(spacing: points(design.at("paragraph-after-pt")))[#paragraph]
  ]
]

#for section in resume.sections [
  #if section.entries.len() > 0 [
    #section-heading(section.title)
    #for (entry-index, entry) in section.entries.enumerate() [
      #if entry-index > 0 [#v(points(design.at("entry-after-pt")))]
      #if section.kind == "experience" or section.kind == "education" [
        #block(sticky: entry.bullets.len() > 0)[
          #grid(
            columns: (1fr, auto),
            column-gutter: 8pt,
            [#text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.title]],
            align(right)[#if entry.dateRange != "" [#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.dateRange]]],
          )
          #par(spacing: points(design.at("paragraph-after-pt")))[
            #if "url" in entry [
              #link(entry.url)[#text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.name]]
            ] else [
              #text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.name]
            ]
          ]
        ]
      ] else if section.kind == "projects" [
        #block(sticky: entry.bullets.len() > 0)[
          #grid(
            columns: (1fr, auto),
            column-gutter: 8pt,
            [#text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.name]],
            align(right)[
              #if "url" in entry [
                #link(entry.url)[#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.urlDisplay]]
              ]
              #if "url" in entry and entry.dateRange != "" [ | ]
              #if entry.dateRange != "" [#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.dateRange]]
            ],
          )
          #if "title" in entry [
            #par(spacing: points(design.at("paragraph-after-pt")))[
              #text(size: points(design.at("project-subtitle-font-pt")), style: "italic", fill: secondary)[#entry.title]
            ]
          ]
        ]
      ] else [
        #block(sticky: entry.bullets.len() > 0)[
          #grid(
            columns: (1fr, auto),
            column-gutter: 8pt,
            [#text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.name]],
            align(right)[#if entry.dateRange != "" [#text(size: points(design.at("entry-detail-font-pt")), fill: secondary)[#entry.dateRange]]],
          )
          #if "issuer" in entry [
            #par(spacing: points(design.at("paragraph-after-pt")))[
              #text(size: points(design.at("entry-detail-font-pt")), style: "italic", fill: secondary)[#entry.issuer]
            ]
          ]
        ]
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

#if resume.skills.len() > 0 [
  #section-heading("TECHNICAL SKILLS")
  #for group in resume.skills [
    #let label = if "category" in group { group.category } else { "Skills" }
    #par(spacing: points(design.at("skill-line-after-pt")))[
      #text(weight: "bold")[#label:] #group.labels.join(", ")
    ]
  ]
]
