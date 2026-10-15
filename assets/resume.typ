#let resume = json("resume.json")
#let design = sys.inputs
#let points(value) = float(value) * 1pt
#set document(
  title: resume.basics.name,
  author: "Resume Toolkit",
  keywords: ("resume", "design-" + design.at("design-version")),
)
#set page(
  width: float(design.at("paper-width-mm")) * 1mm,
  height: float(design.at("paper-height-mm")) * 1mm,
  margin: float(design.at("margins-mm")) * 1mm,
)
#set text(
  font: (
    design.at("font-family"),
    design.at("font-fallback-cjk"),
    design.at("font-fallback-emoji"),
  ),
  size: points(design.at("body-font-pt")),
  fill: black,
)
#set par(justify: false, spacing: points(design.at("paragraph-after-pt")))
#set list(spacing: points(design.at("bullet-after-pt")))
#show heading: set text(size: points(design.at("section-heading-font-pt")), weight: "bold")

#align(center)[
  #text(size: points(design.at("name-font-pt")), weight: "bold")[#resume.basics.name]
  #linebreak()
  #text(size: 9pt)[#(
    (
      if "email" in resume.basics { resume.basics.email } else { none },
      if "phone" in resume.basics { resume.basics.phone } else { none },
      if "location" in resume.basics { resume.basics.location } else { none },
    ).filter(value => value != none and value != "").join(" · ")
  )]
  #if resume.basics.links.len() > 0 [
    #linebreak()
    #for (index, item) in resume.basics.links.enumerate() [
      #if index > 0 [ · ]
      #link(item.url)[#item.label]
    ]
  ]
]

#if resume.summary.len() > 0 [
  #v(float(design.at("section-before-pt")) * 1pt)
  #heading(level: 2)[Summary]
  #for paragraph in resume.summary [
    #par(spacing: points(design.at("paragraph-after-pt")))[#paragraph]
  ]
]

#for section in resume.sections [
  #v(float(design.at("section-before-pt")) * 1pt)
  #heading(level: 2)[#section.title]
  #for entry in section.entries [
    #par(spacing: 1pt)[
      #text(size: points(design.at("entry-heading-font-pt")), weight: "bold")[#entry.name]
      #if "title" in entry [ — #entry.title ]
      #if "issuer" in entry [ — #entry.issuer ]
      #if entry.dateRange != "" [ — #entry.dateRange]
    ]
    #for bullet in entry.bullets [
      #list([#bullet])
    ]
    #if "url" in entry [#par(spacing: 2pt)[#link(entry.url)[#entry.url]]]
  ]
]

#if resume.skills.len() > 0 [
  #v(float(design.at("section-before-pt")) * 1pt)
  #heading(level: 2)[Skills]
  #resume.skills.join(" · ")
]
