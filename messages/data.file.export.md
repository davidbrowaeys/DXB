# summary

Export data from an org based on dxb data plan definition file.

# examples

- Query with a CSV file
  
  <%= config.bin %> <%= command.id %> --file-path ./input/inputFile.csv

- Query against a specific org
  
  <%= config.bin %> <%= command.id %> -f ./input/inputFile.csv --target-org myOrg

- Only query a specific set of the input file

  <%= config.bin %> <%= command.id %> -f ./input/inputFile.csv -o myOrg --min 1 --max 2

# flags.file-path.summary

Path to file containing all content document ids in CSV format

# flags.min.summary

The lowest place of the input that must be included

# flags.max.summary

The highest value of the input that must be included

# log.successful

All files downloaded successfully.

# log.numberToExtract

Number of files to extract: %d

# error.failedDownloads

Failed to download files: %s

# error.failedToDownload

Failed to download file. Status code: %d

# error.contentVersionError

Content Version Error for %s!