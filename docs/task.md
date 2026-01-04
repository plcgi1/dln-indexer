Test Task for TS dev in Data Team

Goal
Design and implement a production-ready application that indexes DLN (deBridge Liquidity Network) order events on Solana, aggregates the data, and visualizes it in an analytical dashboard.
This task is not about a quick MVP. We expect a well-thought-out, high-quality engineering solution, taken as close to “ideal” as reasonably possible within time constraints.
Functional Requirements
1. Data Source

Network: Solana

DLN Programs:
https://docs.debridge.com/dln-details/overview/deployed-contracts

IDLs:
https://github.com/debridge-finance/abis-and-idls/tree/master/idls

2. Events
Index and process the following events:

OrderCreated

OrderFulfilled

Event requirements:


orderId must be present for both events

For OrderCreated, orderId is emitted in encoded logs of the create_order instruction

3. Indexing

The application must collect at least 50,000 orders total:

minimum 25,000 OrderCreated

minimum 25,000 OrderFulfilled



Indexing must be:

restart-safe

deterministic

reproducible



4. Data Aggregation

Calculate daily USD volume:

separately for created orders

separately for fulfilled orders



The approach to USD conversion (oracles, external APIs, assumptions) is up to you, but must be clearly documented

5. Dashboard
Build a dashboard that includes:

daily volume charts (created vs fulfilled)

clear, readable visualizations

basic filtering (e.g. by date range)

focus on clarity and usability, not just functionality

Technical Requirements
Transaction Parsing
You may use:
https://github.com/debridge-finance/solana-tx-parser-public
⚠️ Important:
Using a low-level approach (e.g. manual instruction parsing with Borsh serializers) is a strong plus.
You can find examples of this approach in our libraries.
Technology Stack

You are free to choose the stack

Please be ready to explain:

why this stack was chosen

what trade-offs were made



Preference is given to solutions that are scalable, maintainable, and production-oriented

Quality Expectations
The solution is expected to be:

cleanly structured

readable and well-named

covered with basic tests where appropriate

accompanied by clear documentation

Very important:
The task should be taken to the highest possible level of quality:

clean architecture

no obvious shortcuts or hacks

thoughtful handling of edge cases

clear separation of concerns

This assignment is designed to evaluate engineering thinking and design decisions, not just whether the solution works.
Deliverables
Please provide:

A source code repository

A README.mdcontaining:

setup and run instructions

architecture overview

explanation of key technical decisions



A working dashboard (local or deployed)


(Optional) A short list of improvements you would implement with more time

If any assumptions are made during implementation, document them clearly — this will be considered a plus.
