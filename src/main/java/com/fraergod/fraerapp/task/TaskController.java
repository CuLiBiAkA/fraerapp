package com.fraergod.fraerapp.task;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/tasks")
class TaskController {

	private final TaskRepository tasks;

	TaskController(TaskRepository tasks) {
		this.tasks = tasks;
	}

	@GetMapping
	List<Task> list() {
		return tasks.findAll();
	}

	@PostMapping
	ResponseEntity<Task> create(@Valid @RequestBody TaskRequest request) {
		Task saved = tasks.save(new Task(request.title().trim()));
		return ResponseEntity.created(URI.create("/api/tasks/" + saved.getId())).body(saved);
	}

	@PutMapping("/{id}")
	Task update(@PathVariable Long id, @Valid @RequestBody TaskRequest request) {
		Task task = tasks.findById(id).orElseThrow(TaskNotFoundException::new);
		task.setTitle(request.title().trim());
		task.setCompleted(request.completed());
		return tasks.save(task);
	}

	@DeleteMapping("/{id}")
	ResponseEntity<Void> delete(@PathVariable Long id) {
		if (!tasks.existsById(id)) {
			throw new TaskNotFoundException();
		}
		tasks.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	record TaskRequest(
			@NotBlank @Size(max = 160) String title,
			boolean completed) {
	}
}
