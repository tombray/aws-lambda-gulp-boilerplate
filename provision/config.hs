#!/usr/bin/env stack
-- stack runhaskell --package cloud-seeder
{-# LANGUAGE OverloadedStrings #-}

import Network.CloudSeeder

main :: IO ()
main = cliIO $ deployment "rds-backup" $ do
  tags [("cj:squad", "lambda")]
  stack_ "lambda"
