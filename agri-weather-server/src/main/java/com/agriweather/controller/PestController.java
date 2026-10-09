package com.agriweather.controller;

import com.agriweather.entity.PestKnowledge;
import com.agriweather.repository.PestKnowledgeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pests")
@RequiredArgsConstructor
public class PestController {

    private final PestKnowledgeRepository pestKnowledgeRepository;

    @GetMapping
    public List<PestKnowledge> listAll() {
        return pestKnowledgeRepository.findAll();
    }

    @GetMapping("/type/{type}")
    public List<PestKnowledge> byType(@PathVariable String type) {
        return pestKnowledgeRepository.findByPestType(type);
    }
}
