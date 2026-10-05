import { Deck, fadeTransition } from 'spectacle'
import { theme } from './theme'
import { S01Title } from './slides/S01Title'
import { S02OpenLab } from './slides/S02OpenLab'
import { S03Hook } from './slides/S03Hook'
import { S04Lakeshore } from './slides/S04Lakeshore'
import { S05Demo } from './slides/S05Demo'
import { S06WhyItHurts } from './slides/S06WhyItHurts'
import { S07Map } from './slides/S07Map'
import { S08HowLabsWork } from './slides/S08HowLabsWork'
import { S09Architecture } from './slides/S09Architecture'
import { S10Lab1Go } from './slides/S10Lab1Go'
import { S11Debrief1 } from './slides/S11Debrief1'
import { S12Identity } from './slides/S12Identity'
import { S13Rules } from './slides/S13Rules'
import { S14Lab2Go } from './slides/S14Lab2Go'
import { S15Debrief2 } from './slides/S15Debrief2'
import { S16Observe } from './slides/S16Observe'
import { S17Lab3Go } from './slides/S17Lab3Go'
import { S18Recall } from './slides/S18Recall'
import { S19TakeHome } from './slides/S19TakeHome'
import { S20Thanks } from './slides/S20Thanks'

/**
 * Run of show (DESIGN.md §3), 75 minutes:
 *   0:00 welcome + open Codespace · 0:02 hook + live demo · 0:07 map + router
 *   0:10 Lab 0 → Lab 1 · 0:32 debrief + identity · 0:36 Lab 2
 *   0:54 debrief + observe · 0:57 Lab 3 · 1:09 recall, take-home, feedback
 */
export function Presentation() {
  return (
    <Deck theme={theme} transition={fadeTransition}>
      <S01Title />
      <S02OpenLab />
      <S03Hook />
      <S04Lakeshore />
      <S05Demo />
      <S06WhyItHurts />
      <S07Map />
      <S08HowLabsWork />
      <S09Architecture />
      <S10Lab1Go />
      <S11Debrief1 />
      <S12Identity />
      <S13Rules />
      <S14Lab2Go />
      <S15Debrief2 />
      <S16Observe />
      <S17Lab3Go />
      <S18Recall />
      <S19TakeHome />
      <S20Thanks />
    </Deck>
  )
}
