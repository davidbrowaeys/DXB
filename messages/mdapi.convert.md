# summary

Enhances mdapi convert.

# description

Override mdapi convert standard behavior that create a dup file if file exist already.
Instead it delete old file and remame .dup by actual file.

# examples

- Specify a directory containing the MetaData API-formatted metadata

  <%= config.bin %> <%= command.id %> --root-dir tmp

- Specify a directory to store the output

  <%= config.bin %> <%= command.id %> -r tmp --output-dir out

# flags.root-dir.summary

The root directory containing the Metadata API–formatted metadata

# flags.output-dir.summary

The output directory to store the source–formatted files
